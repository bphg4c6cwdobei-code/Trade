// Suspicion radar — statistical anomaly flags on PUBLIC data.
//
// Honesty contract: "suspicious" here means statistically unusual relative to
// the current universe, nothing more. Unusual ≠ illegal ≠ insider activity.
// These are descriptive flags, not accusations, and they must never be
// presented as evidence of wrongdoing by anyone.
//
// Tier 1 signals are computed from data the app already loads (CoinGecko
// rows, equity closes/volumes) and work for any instrument in the universe —
// crypto, stocks, bond/commodity ETFs alike. Tier 2 overlays (SEC Form 4
// filing intensity, politician-trade feeds, on-chain whale flow) are optional
// and contribute only when their source actually loaded.

import { mean, std, logRet, zscore } from './math.js'

export const SUS_META = {
  turnover: { code: 'TURN', name: 'Turnover anomaly', desc: 'Traded volume unusually large vs market cap (crypto) — churn without obvious cause.' },
  volSurge: { code: 'VSRG', name: 'Volume surge', desc: 'Recent 5-day dollar volume far above the ~1y baseline — activity often precedes news.' },
  diverge: { code: 'DIVG', name: 'Price–volume divergence', desc: 'Heavy volume while price barely moves — the classic accumulation/distribution footprint.' },
  regime: { code: 'SPKE', name: 'Volatility regime spike', desc: 'Last-24h volatility far above the asset\'s own 7-day norm (crypto).' },
  moveSpike: { code: 'MOVE', name: 'Move spike', desc: 'A single-day move far outside the asset\'s own historical volatility.' },
  pump: { code: 'PUMP', name: 'Pump extremity', desc: '24h return extreme vs the rest of the universe.' },
  insider: { code: 'FRM4', name: 'Insider filing intensity', desc: 'SEC Form 4 (insider transaction) filings mentioning the ticker in the last 30 days — EDGAR full-text. Filing ≠ wrongdoing; insiders file legally all the time.' },
  politician: { code: 'POL', name: 'Lawmaker trades', desc: 'Publicly disclosed STOCK Act trades from a user-supplied feed. Disclosure ≠ wrongdoing.' },
}

export const SUS_LEVELS = { high: 1.5, elevated: 0.75 }

const fin = (v) => (Number.isFinite(v) ? v : null)

// ---- tier 1 raw signals ----------------------------------------------------

// coin: CoinGecko markets row. Returns raw (un-normalized) signal values.
export function cryptoSusRaw(coin) {
  const vol = fin(coin.total_volume)
  const mcap = fin(coin.market_cap)
  const pc24 = fin(coin.price_change_percentage_24h_in_currency)
  const turnover = vol != null && mcap > 0 ? vol / mcap : null

  const spark = (coin.sparkline_in_7d?.price || []).filter((v) => Number.isFinite(v) && v > 0)
  const rets = logRet(spark)
  let regime = null
  if (rets.length >= 48) {
    const all = std(rets)
    const last24 = std(rets.slice(-24))
    if (all > 0) regime = last24 / all
  }
  // heavy churn while price goes nowhere
  const diverge = turnover != null && pc24 != null ? turnover / (1 + Math.abs(pc24)) : null
  return { turnover, regime, diverge, pump: pc24 != null ? Math.abs(pc24) : null }
}

// row: { closes, volumes } ≈ 1y of dailies.
export function equitySusRaw(row) {
  const { closes, volumes } = row
  if (!closes || closes.length < 30 || !volumes || volumes.length !== closes.length) {
    return { volSurge: null, moveSpike: null, diverge: null }
  }
  const dollar = closes.map((c, i) => c * (volumes[i] || 0))
  const recent = mean(dollar.slice(-5))
  const base = mean(dollar.slice(0, -5))
  const volSurge = base > 0 && recent > 0 ? Math.log(recent / base) : null

  const rets = logRet(closes)
  const sd = std(rets)
  let moveSpike = null
  if (sd > 0 && rets.length >= 5) {
    moveSpike = Math.max(...rets.slice(-5).map(Math.abs)) / sd
  }
  const last = closes[closes.length - 1]
  const wkAgo = closes[closes.length - 6]
  const net5d = wkAgo > 0 ? Math.abs((last / wkAgo - 1) * 100) : null
  const diverge = volSurge != null && net5d != null ? volSurge / (1 + net5d) : null
  return { volSurge, moveSpike, diverge }
}

// ---- composite --------------------------------------------------------------

const CRYPTO_WEIGHTS = { turnover: 0.3, diverge: 0.25, regime: 0.25, pump: 0.2 }
const EQUITY_WEIGHTS = { volSurge: 0.3, moveSpike: 0.2, diverge: 0.2, insider: 0.2, politician: 0.1 }

export function susLevel(score) {
  if (score >= SUS_LEVELS.high) return 'high'
  if (score >= SUS_LEVELS.elevated) return 'elevated'
  return 'normal'
}

/**
 * Compute per-asset suspicion scores WITHIN the current universe.
 * assets: [{ symbol, susRaw: {signal: rawValue} }]
 * overlays: { insider?: {SYM: count30d}, politician?: {SYM: count90d} }
 * Returns map symbol -> { signals: {key: z}, score, level, overlayNote }
 * Overlay counts are log-compressed before z-scoring; a missing overlay source
 * contributes NOTHING (not zero-count evidence) to every asset equally.
 */
export function computeSusScores(assets, assetClass, overlays = {}) {
  if (!assets || assets.length === 0) return {}
  const weights = assetClass === 'crypto' ? CRYPTO_WEIGHTS : EQUITY_WEIGHTS
  const keys = Object.keys(weights)

  const columns = {}
  for (const k of keys) {
    if (k === 'insider' || k === 'politician') {
      const src = overlays[k]
      columns[k] = src
        ? assets.map((a) => (Number.isFinite(src[a.symbol]) ? Math.log(1 + src[a.symbol]) : null))
        : null // source absent: signal is out of the model entirely
    } else {
      columns[k] = assets.map((a) => fin(a.susRaw?.[k]))
    }
  }

  const zs = {}
  let usedWeight = 0
  for (const k of keys) {
    if (columns[k] == null) continue
    zs[k] = zscore(columns[k])
    usedWeight += weights[k]
  }
  const out = {}
  assets.forEach((a, i) => {
    const signals = {}
    let score = 0
    for (const k of Object.keys(zs)) {
      signals[k] = zs[k][i]
      score += weights[k] * zs[k][i]
    }
    score = usedWeight > 0 ? score / usedWeight : 0
    out[a.symbol] = { signals, score, level: susLevel(score) }
  })
  return out
}

// Top offenders for the radar panel, most suspicious first.
export function susRanking(assets, susMap) {
  return assets
    .map((a) => ({ ...a, sus: susMap[a.symbol] }))
    .filter((a) => a.sus)
    .sort((x, y) => y.sus.score - x.sus.score)
}
