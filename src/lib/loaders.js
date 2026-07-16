// Data loaders for all sources: CoinGecko (crypto), Yahoo/Stooq via relays,
// GitHub price feed, TwelveData, static snapshot, VIX CSV.

import { smartFetchText, fetchTextWithTimeout, sleep, RELAY_TIMEOUT_MS } from './transports.js'

// ---------------------------------------------------------------- crypto ---

export const COINGECKO_URL =
  'https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&order=market_cap_desc&per_page=60&page=1&sparkline=true&price_change_percentage=1h%2C24h%2C7d%2C14d%2C30d'

// Stablecoins + wrapped/staked derivatives excluded from the crypto universe.
export const CRYPTO_DENY = new Set([
  'usdt', 'usdc', 'dai', 'usds', 'usde', 'fdusd', 'tusd', 'busd', 'pyusd', 'usd1',
  'gusd', 'frax', 'lusd', 'usdd', 'usdp',
  'weth', 'wbtc', 'wsteth', 'steth', 'weeth', 'reth', 'cbeth', 'rseth', 'wbeth',
  'meth', 'jitosol', 'msol', 'bsol', 'lseth', 'ezeth', 'solvbtc', 'wbnb', 'wavax',
  'cbbtc', 'lbtc', 'tbtc',
])

export const CRYPTO_UNIVERSE_SIZE = 22

// Fetch the crypto universe. Simple backoff retry on 429.
export async function loadCrypto(signal) {
  let lastErr = null
  for (let attempt = 0; attempt < 3; attempt++) {
    if (signal?.aborted) throw new DOMException('Aborted', 'AbortError')
    try {
      const res = await fetch(COINGECKO_URL, { signal })
      if (res.status === 429) {
        lastErr = new Error('rate limited (429)')
        await sleep(1500 * Math.pow(2, attempt), signal)
        continue
      }
      if (!res.ok) throw new Error(`CoinGecko HTTP ${res.status}`)
      const rows = await res.json()
      if (!Array.isArray(rows)) throw new Error('CoinGecko: unexpected payload')
      const filtered = rows.filter((c) => {
        if (!c || CRYPTO_DENY.has(String(c.symbol || '').toLowerCase())) return false
        const spark = c.sparkline_in_7d?.price
        if (!Array.isArray(spark)) return false
        const numeric = spark.filter((v) => Number.isFinite(v))
        return numeric.length > 30
      })
      return filtered.slice(0, CRYPTO_UNIVERSE_SIZE)
    } catch (e) {
      if (e?.name === 'AbortError') throw e
      lastErr = e
      if (attempt < 2) await sleep(1200 * Math.pow(2, attempt), signal)
    }
  }
  throw lastErr || new Error('CoinGecko failed')
}

// -------------------------------------------------------------- equities ---

export function parseSymbols(input, cap = 10) {
  const syms = String(input || '')
    .split(/[\s,;]+/)
    .map((s) => s.trim().toUpperCase())
    .filter(Boolean)
  const uniq = [...new Set(syms)]
  // SPY is always present: it is the beta benchmark.
  if (!uniq.includes('SPY')) uniq.unshift('SPY')
  return uniq.slice(0, cap)
}

export function yahooChartUrl(sym) {
  return `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(sym)}?range=1y&interval=1d`
}

export function parseYahooChart(text) {
  const j = JSON.parse(text)
  const err = j?.chart?.error
  if (err) throw new Error(err.description || err.code || 'yahoo error')
  const r = j?.chart?.result?.[0]
  if (!r) throw new Error('yahoo: empty result')
  const rawCloses = r.indicators?.quote?.[0]?.close || []
  const rawVols = r.indicators?.quote?.[0]?.volume || []
  const closes = []
  const volumes = []
  // Yahoo arrays contain nulls — filter pairwise so volume stays aligned.
  for (let i = 0; i < rawCloses.length; i++) {
    if (Number.isFinite(rawCloses[i])) {
      closes.push(rawCloses[i])
      volumes.push(Number.isFinite(rawVols[i]) ? rawVols[i] : 0)
    }
  }
  if (closes.length < 40) throw new Error(`yahoo: only ${closes.length} closes`)
  return {
    closes,
    volumes,
    name: r.meta?.shortName || r.meta?.symbol || '',
    exchange: r.meta?.exchangeName || '',
  }
}

export function stooqUrl(sym) {
  const s = sym.toLowerCase()
  const suffixed = s.includes('.') || s.startsWith('^') ? s : `${s}.us`
  return `https://stooq.com/q/d/l/?s=${encodeURIComponent(suffixed)}&i=d`
}

export function parseStooqCsv(text) {
  const lines = text.trim().split(/\r?\n/)
  if (lines.length < 42 || !/^date,open,high,low,close/i.test(lines[0])) {
    throw new Error('stooq: not a daily CSV')
  }
  const closes = []
  const volumes = []
  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(',')
    const close = parseFloat(cols[4])
    const vol = parseFloat(cols[5])
    if (Number.isFinite(close)) {
      closes.push(close)
      volumes.push(Number.isFinite(vol) ? vol : 0)
    }
  }
  if (closes.length < 40) throw new Error(`stooq: only ${closes.length} closes`)
  // Keep roughly one year of dailies.
  return { closes: closes.slice(-260), volumes: volumes.slice(-260), name: '', exchange: 'stooq' }
}

/**
 * Load equities through the keyless relay chain: Yahoo first, Stooq as
 * per-symbol fallback. ~280ms pacing between symbols; adaptive relay prefer.
 * opts: { customProxy, signal, onLog, onProgress }
 * Returns { rows, summary, loaded, total }
 */
export async function loadEquitiesRelay(symbols, opts = {}) {
  const { customProxy, signal, onLog, onProgress } = opts
  const rows = []
  let preferRelayId = null
  const tally = new Map() // "yahoo·allorigins" -> count

  for (let i = 0; i < symbols.length; i++) {
    const sym = symbols[i]
    if (signal?.aborted) throw new DOMException('Aborted', 'AbortError')
    if (i > 0) await sleep(280, signal)
    onProgress && onProgress(`${sym} (${i + 1}/${symbols.length})…`)

    let row = null
    try {
      const { text, via } = await smartFetchText(yahooChartUrl(sym), {
        customProxy, preferRelayId, signal, onLog, label: `${sym} yahoo`,
      })
      row = { symbol: sym, ...parseYahooChart(text), source: 'yahoo', via }
      if (via !== 'direct' && via !== 'custom') preferRelayId = via
    } catch (e) {
      if (e?.name === 'AbortError') throw e
      onLog && onLog(`${sym} yahoo unusable: ${e.message}`)
    }

    if (!row) {
      try {
        const { text, via } = await smartFetchText(stooqUrl(sym), {
          customProxy, preferRelayId, signal, onLog, label: `${sym} stooq`,
        })
        row = { symbol: sym, ...parseStooqCsv(text), source: 'stooq', via }
        if (via !== 'direct' && via !== 'custom') preferRelayId = via
      } catch (e) {
        if (e?.name === 'AbortError') throw e
        onLog && onLog(`${sym} stooq unusable: ${e.message}`)
      }
    }

    if (row) {
      rows.push(row)
      const key = `${row.source}·${row.via}`
      tally.set(key, (tally.get(key) || 0) + 1)
      onLog && onLog(`${sym} ok via ${key} (${row.closes.length} closes)`)
    } else {
      onLog && onLog(`${sym} FAILED on every transport`)
    }
  }

  const parts = [...tally.entries()].map(([k, n]) => `${k}×${n}`)
  const summary = `${rows.length}/${symbols.length} loaded${parts.length ? ' · ' + parts.join(' · ') : ''}`
  return { rows, summary, loaded: rows.length, total: symbols.length }
}

// ------------------------------------------------------------ github feed ---

// Fact (verified): raw.githubusercontent.com serves public files with
// Access-Control-Allow-Origin: * — browsers can fetch it directly, no proxy.
export function ghFeedCandidates(input) {
  const s = String(input || '').trim()
  if (!s) return []
  if (/^https?:\/\//i.test(s)) return [s]
  const u = s.replace(/^\/+|\/+$/g, '')
  return [
    `https://raw.githubusercontent.com/${u}/main/docs/prices.json`,
    `https://raw.githubusercontent.com/${u}/master/docs/prices.json`,
    `https://cdn.jsdelivr.net/gh/${u}@main/docs/prices.json`,
  ]
}

export function parseGhFeed(text) {
  const j = JSON.parse(text)
  if (!j || typeof j.series !== 'object' || j.series == null) {
    throw new Error('feed: missing "series" object')
  }
  const rows = []
  const skipped = []
  for (const [sym, s] of Object.entries(j.series)) {
    const closes = Array.isArray(s?.closes) ? s.closes.filter((v) => Number.isFinite(v)) : []
    const volumes = Array.isArray(s?.volumes) ? s.volumes : []
    if (closes.length > 40) {
      rows.push({
        symbol: sym.toUpperCase(),
        closes,
        volumes: closes.map((_, i) => (Number.isFinite(volumes[i]) ? volumes[i] : 0)),
        name: '',
        exchange: 'gh-feed',
        source: 'gh-feed',
        via: 'direct',
      })
    } else {
      skipped.push(sym)
    }
  }
  if (rows.length === 0) throw new Error('feed: no symbol has >40 closes')
  return { rows, updated: j.updated || null, skipped }
}

export async function loadGhFeed(input, { signal, onLog } = {}) {
  const candidates = ghFeedCandidates(input)
  if (candidates.length === 0) throw new Error('enter "user/repo" or a raw URL')
  let lastErr = null
  for (const url of candidates) {
    if (signal?.aborted) throw new DOMException('Aborted', 'AbortError')
    try {
      const text = await fetchTextWithTimeout(url, RELAY_TIMEOUT_MS, signal)
      const feed = parseGhFeed(text)
      onLog && onLog(`feed ok: ${url} (${feed.rows.length} symbols${feed.updated ? ', updated ' + feed.updated : ''})`)
      if (feed.skipped.length) onLog && onLog(`feed skipped (≤40 closes): ${feed.skipped.join(', ')}`)
      return { ...feed, url }
    } catch (e) {
      if (e?.name === 'AbortError') throw e
      lastErr = e
      onLog && onLog(`feed failed: ${url} — ${e.message}`)
    }
  }
  throw lastErr || new Error('feed unreachable')
}

// ------------------------------------------------------------- twelvedata ---

export function twelveDataUrl(sym, key) {
  return `https://api.twelvedata.com/time_series?symbol=${encodeURIComponent(sym)}&interval=1day&outputsize=260&apikey=${encodeURIComponent(key)}`
}

// Free tier ≈ 8 req/min, 800/day — pace 180ms, stop gracefully on 429.
export async function loadTwelveData(symbols, key, { signal, onLog, onProgress } = {}) {
  const rows = []
  let rateLimited = false
  for (let i = 0; i < symbols.length; i++) {
    const sym = symbols[i]
    if (signal?.aborted) throw new DOMException('Aborted', 'AbortError')
    if (i > 0) await sleep(180, signal)
    onProgress && onProgress(`${sym} (${i + 1}/${symbols.length})…`)
    try {
      const res = await fetch(twelveDataUrl(sym, key), { signal })
      const j = await res.json()
      const msg = String(j?.message || '')
      if (res.status === 429 || j?.code === 429 || /run out|limit/i.test(msg)) {
        onLog && onLog(`TwelveData rate limit hit at ${sym}: ${msg || 'HTTP 429'}`)
        rateLimited = true
        break
      }
      if (j?.status === 'error') throw new Error(msg || `code ${j?.code}`)
      const values = Array.isArray(j?.values) ? j.values : []
      if (values.length < 40) throw new Error(`only ${values.length} bars`)
      // values[] arrive newest-first — reverse into chronological order.
      const chron = values.slice().reverse()
      const closes = []
      const volumes = []
      for (const v of chron) {
        const c = parseFloat(v.close)
        if (Number.isFinite(c)) {
          closes.push(c)
          volumes.push(Number.isFinite(parseFloat(v.volume)) ? parseFloat(v.volume) : 0)
        }
      }
      rows.push({ symbol: sym, closes, volumes, name: '', exchange: 'twelvedata', source: 'twelvedata', via: 'direct' })
      onLog && onLog(`${sym} ok via twelvedata (${closes.length} closes)`)
    } catch (e) {
      if (e?.name === 'AbortError') throw e
      onLog && onLog(`${sym} twelvedata failed: ${e.message}`)
    }
  }
  const summary = `${rows.length}/${symbols.length} loaded via twelvedata${rateLimited ? ' · stopped early: rate limit' : ''}`
  return { rows, summary, loaded: rows.length, total: symbols.length, rateLimited }
}

// --------------------------------------------------------------- snapshot ---

// Static indicative snapshot (early June 2026) — the floor mode that never
// fails. Values are indicative only and labeled as such in the UI; missing
// fields render as "—" and contribute neutrally (z = 0) to the ranking.
export const STOCK_SNAPSHOT = [
  { symbol: 'NVDA', name: 'NVIDIA Corp.', price: 172.4, r1w: 1.9, r1m: 6.2, r3m: 14.8, r6m: 22.5, r1y: 41.0, volAnn: 0.44, dollarVol: 2.9e10, beta: 1.7, maxDD: -0.21, asOf: '2026-06-05' },
  { symbol: 'QQQ', name: 'Invesco QQQ Trust', price: 552.1, r1w: 0.8, r1m: 3.1, r3m: 7.4, r6m: 11.2, r1y: 18.9, volAnn: 0.19, dollarVol: 1.6e10, beta: 1.1, maxDD: -0.12, asOf: '2026-06-05' },
  { symbol: 'SPY', name: 'SPDR S&P 500 ETF', price: 631.7, r1w: 0.5, r1m: 2.2, r3m: 5.1, r6m: 8.6, r1y: 13.4, volAnn: 0.14, dollarVol: 3.1e10, beta: 1.0, maxDD: -0.09, asOf: '2026-06-05' },
  { symbol: 'GOOGL', name: 'Alphabet Inc.', price: 201.3, r1w: -0.6, r1m: 4.4, r3m: 9.7, r6m: 15.3, r1y: 24.6, volAnn: 0.27, dollarVol: 8.2e9, beta: 1.2, maxDD: -0.15, asOf: '2026-06-04' },
  { symbol: 'MSFT', name: 'Microsoft Corp.', price: 512.9, r1w: 0.3, r1m: 1.8, r3m: 4.9, r6m: 9.8, r1y: 16.1, volAnn: 0.2, dollarVol: 1.1e10, beta: 0.95, maxDD: -0.11, asOf: '2026-06-05' },
  { symbol: 'BABA', name: 'Alibaba Group', price: 118.6, r1w: 2.7, r1m: 8.9, r3m: 18.2, r6m: 26.4, r1y: null, volAnn: 0.39, dollarVol: 3.4e9, beta: null, maxDD: -0.28, asOf: '2026-06-03' },
]

// -------------------------------------------------------------------- vix ---

export const VIX_URLS = [
  'https://raw.githubusercontent.com/datasets/finance-vix/main/data/vix-daily.csv',
  'https://raw.githubusercontent.com/datasets/finance-vix/master/data/vix-daily.csv',
  'https://cdn.jsdelivr.net/gh/datasets/finance-vix@main/data/vix-daily.csv',
]

// CSV columns: DATE,OPEN,HIGH,LOW,CLOSE — close is index 4.
export function parseVixCsv(text) {
  const lines = text.trim().split(/\r?\n/)
  const series = []
  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(',')
    const close = parseFloat(cols[4])
    if (cols[0] && Number.isFinite(close)) series.push({ date: cols[0], close })
  }
  if (series.length < 2) throw new Error('vix: too few rows')
  const last = series[series.length - 1]
  const prev = series[series.length - 2]
  return { last, prev, series: series.slice(-90) }
}

export async function loadVix(signal) {
  let lastErr = null
  for (const url of VIX_URLS) {
    if (signal?.aborted) throw new DOMException('Aborted', 'AbortError')
    try {
      const text = await fetchTextWithTimeout(url, RELAY_TIMEOUT_MS, signal)
      return parseVixCsv(text)
    } catch (e) {
      if (e?.name === 'AbortError') throw e
      lastErr = e
    }
  }
  throw lastErr || new Error('vix unreachable')
}
