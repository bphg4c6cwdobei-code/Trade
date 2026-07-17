// Optional external sources for the suspicion radar. Every loader here can
// fail — and must fail LOUDLY (log line, status chip) while the tier-1
// computed signals keep working. Nothing is ever fabricated on failure.

import { fetchTextWithTimeout, sleep, RELAY_TIMEOUT_MS } from './transports.js'

// ---- SEC EDGAR Form 4 filing intensity (stocks) ----------------------------
// EDGAR full-text search API (efts.sec.gov) serves JSON with CORS enabled —
// it backs the public search UI on a different origin. Form 4 = insider
// transaction report. Counting filings that mention a ticker over the last
// 30 days is a coarse "insider activity" pulse: legal, public, and NOT
// evidence of wrongdoing.

export function edgarForm4Url(sym, startISO, endISO) {
  return `https://efts.sec.gov/LATEST/search-index?q=${encodeURIComponent(`"${sym}"`)}&forms=4&dateRange=custom&startdt=${startISO}&enddt=${endISO}`
}

export function parseEdgarCount(text) {
  const j = JSON.parse(text)
  const total = j?.hits?.total
  const v = typeof total === 'number' ? total : total?.value
  if (!Number.isFinite(v)) throw new Error('EDGAR: no hits.total in response')
  return v
}

// Returns { bySymbol: {SYM: count}, failed: [SYM] }. ~350ms pacing (EDGAR
// tolerates ~10 req/s; we stay far under).
export async function loadInsiderCounts(symbols, { signal, onLog, now = Date.now() } = {}) {
  const end = new Date(now)
  const start = new Date(now - 30 * 24 * 3600 * 1000)
  const iso = (d) => d.toISOString().slice(0, 10)
  const bySymbol = {}
  const failed = []
  for (let i = 0; i < symbols.length; i++) {
    const sym = symbols[i]
    if (signal?.aborted) throw new DOMException('Aborted', 'AbortError')
    if (i > 0) await sleep(350, signal)
    try {
      const text = await fetchTextWithTimeout(edgarForm4Url(sym, iso(start), iso(end)), RELAY_TIMEOUT_MS, signal)
      bySymbol[sym] = parseEdgarCount(text)
    } catch (e) {
      if (e?.name === 'AbortError') throw e
      failed.push(sym)
      onLog && onLog(`EDGAR Form 4 for ${sym} failed: ${e.message}`)
    }
  }
  return { bySymbol, failed }
}

// ---- On-chain whale flow (crypto) -------------------------------------------
// Chain of key-less, CORS-enabled sources for freshly seen BTC transactions:
//   1. blockchain.info with ?cors=true (latest ~100 unconfirmed txs)
//   2. mempool.space public API (last ~10 txs entering the mempool)
// "Whale" = total output above WHALE_MIN_BTC. Large transfers are routine
// (exchange sweeps, custody moves); the ticker shows flow, it does not
// identify anyone or imply anything illicit.

export const WHALE_MIN_BTC = 5
const SATS = 1e8

export function parseBlockchainInfoTxs(text) {
  const j = JSON.parse(text)
  const txs = Array.isArray(j?.txs) ? j.txs : []
  return txs.map((t) => ({
    txid: t.hash,
    time: (t.time || 0) * 1000,
    btc: (t.out || []).reduce((s, o) => s + (o.value || 0), 0) / SATS,
  }))
}

export function parseMempoolRecent(text) {
  const j = JSON.parse(text)
  if (!Array.isArray(j)) throw new Error('mempool: not an array')
  return j.map((t) => ({ txid: t.txid, time: null, btc: (t.value || 0) / SATS }))
}

export const WHALE_SOURCES = [
  { id: 'blockchain.info', url: 'https://blockchain.info/unconfirmed-transactions?format=json&cors=true', parse: parseBlockchainInfoTxs },
  { id: 'mempool.space', url: 'https://mempool.space/api/mempool/recent', parse: parseMempoolRecent },
]

export async function loadWhaleTxs({ signal, onLog } = {}) {
  let lastErr = null
  for (const src of WHALE_SOURCES) {
    if (signal?.aborted) throw new DOMException('Aborted', 'AbortError')
    try {
      const text = await fetchTextWithTimeout(src.url, RELAY_TIMEOUT_MS, signal)
      const txs = src.parse(text)
      return { source: src.id, sampled: txs.length, whales: txs.filter((t) => t.btc >= WHALE_MIN_BTC) }
    } catch (e) {
      if (e?.name === 'AbortError') throw e
      lastErr = e
      onLog && onLog(`whale source ${src.id} failed: ${e.message}`)
    }
  }
  throw lastErr || new Error('all whale sources failed')
}

// ---- Politician / STOCK Act trade feed (stocks, optional) -------------------
// The once-popular public mirrors (Senate/House Stock Watcher S3 buckets)
// are DEAD — verified returning AccessDenied. Rather than fake it, this
// accepts a user-supplied feed (same raw-GitHub pattern as the price feed).
// Schema: { "updated": ISO8601, "trades": [ { "ticker": "NVDA",
//   "chamber": "house"|"senate", "name": "...", "side": "buy"|"sell",
//   "date": "YYYY-MM-DD", "amount": "$1,001 - $15,000" } ] }

export function politicianFeedCandidates(input) {
  const s = String(input || '').trim()
  if (!s) return []
  if (/^https?:\/\//i.test(s)) return [s]
  const u = s.replace(/^\/+|\/+$/g, '')
  return [
    `https://raw.githubusercontent.com/${u}/main/docs/congress.json`,
    `https://raw.githubusercontent.com/${u}/master/docs/congress.json`,
    `https://cdn.jsdelivr.net/gh/${u}@main/docs/congress.json`,
  ]
}

export function parsePoliticianFeed(text, { now = Date.now(), windowDays = 90 } = {}) {
  const j = JSON.parse(text)
  if (!Array.isArray(j?.trades)) throw new Error('feed: missing "trades" array')
  const cutoff = now - windowDays * 24 * 3600 * 1000
  const bySymbol = {}
  const recent = []
  for (const t of j.trades) {
    const sym = String(t.ticker || '').toUpperCase()
    const ts = Date.parse(t.date)
    if (!sym || !Number.isFinite(ts) || ts < cutoff) continue
    bySymbol[sym] = (bySymbol[sym] || 0) + 1
    recent.push({ ...t, ticker: sym, ts })
  }
  recent.sort((a, b) => b.ts - a.ts)
  return { bySymbol, recent: recent.slice(0, 50), updated: j.updated || null }
}

export async function loadPoliticianFeed(input, { signal, onLog, now = Date.now() } = {}) {
  const candidates = politicianFeedCandidates(input)
  if (candidates.length === 0) throw new Error('enter "user/repo" or a raw URL')
  let lastErr = null
  for (const url of candidates) {
    if (signal?.aborted) throw new DOMException('Aborted', 'AbortError')
    try {
      const text = await fetchTextWithTimeout(url, RELAY_TIMEOUT_MS, signal)
      const feed = parsePoliticianFeed(text, { now })
      onLog && onLog(`politician feed ok: ${url} (${feed.recent.length} trades in window)`)
      return { ...feed, url }
    } catch (e) {
      if (e?.name === 'AbortError') throw e
      lastErr = e
      onLog && onLog(`politician feed failed: ${url} — ${e.message}`)
    }
  }
  throw lastErr || new Error('feed unreachable')
}
