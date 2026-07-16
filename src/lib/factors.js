// The quant engine: per-asset primitives, presets, and within-universe ranking.
// Z-scores are always computed WITHIN the current universe, never across asset
// classes — that is the calibration point ("high vol" ≈ 80%+ for crypto vs
// ≈ 40% for equities). Missing values contribute neutrally (z = 0).

import { std, logRet, linreg, maxDD, betaOf, zscore, mean } from './math.js'

export const FACTOR_KEYS = ['mom', 'vol', 'liq', 'trend', 'res', 'beta']

export const FACTOR_META = {
  mom: { code: 'MOM', name: 'Momentum', desc: 'Blended recent returns; horizon picks the short or long blend.' },
  vol: { code: 'VOL', name: 'Volatility', desc: 'Annualized return volatility. Rewarded for day trading, penalized long-term.' },
  liq: { code: 'LIQ', name: 'Liquidity', desc: 'Log of traded volume (dollar volume for equities).' },
  trend: { code: 'TRD', name: 'Trend', desc: 'OLS slope of log-price × R² × 1000 — smooth persistent drift scores high.' },
  res: { code: 'RES', name: 'Resilience', desc: 'Max drawdown (negative). Shallower drawdowns score higher.' },
  beta: { code: 'β', name: 'Beta', desc: 'Sensitivity vs the benchmark (BTC for crypto, SPY for equities).' },
}

// Preset weights per quadrant. volSign: volatility helps day trading (+),
// hurts long-term (−). momKey picks the momentum blend for the horizon.
export const PRESETS = {
  'crypto|day': { weights: { mom: 32, vol: 24, liq: 24, trend: 14, res: 6, beta: 0 }, volSign: 1, momKey: 'momS' },
  'crypto|long': { weights: { mom: 30, vol: 12, liq: 15, trend: 20, res: 23, beta: 0 }, volSign: -1, momKey: 'momL' },
  'stocks|day': { weights: { mom: 25, vol: 22, liq: 28, trend: 10, res: 5, beta: 10 }, volSign: 1, momKey: 'momS' },
  'stocks|long': { weights: { mom: 26, vol: 16, liq: 15, trend: 18, res: 25, beta: 0 }, volSign: -1, momKey: 'momL' },
}

export function quadKey(assetClass, horizon) {
  return `${assetClass}|${horizon}`
}

const finiteOr = (v, fallback = null) => (Number.isFinite(v) ? v : fallback)

// Weighted blend that returns null if ANY component is missing.
function blend(pairs) {
  let s = 0
  for (const [w, v] of pairs) {
    if (!Number.isFinite(v)) return null
    s += w * v
  }
  return s
}

// ------------------------------------------------------ crypto primitives ---

// coin: a CoinGecko markets row (with sparkline_in_7d). btcReturns: hourly
// log returns of BTC's sparkline, used as the beta benchmark.
export function cryptoPrimitives(coin, btcReturns) {
  const prices = (coin.sparkline_in_7d?.price || []).filter((v) => Number.isFinite(v) && v > 0)
  const rets = logRet(prices)
  const pc1h = finiteOr(coin.price_change_percentage_1h_in_currency)
  const pc24h = finiteOr(coin.price_change_percentage_24h_in_currency)
  const pc7d = finiteOr(coin.price_change_percentage_7d_in_currency)
  const pc14d = finiteOr(coin.price_change_percentage_14d_in_currency)
  const pc30d = finiteOr(coin.price_change_percentage_30d_in_currency)

  const volAnn = rets.length >= 2 ? std(rets) * Math.sqrt(24 * 365) : null
  const momS = blend([[0.25, pc1h], [0.45, pc24h], [0.30, pc7d]])
  const momL = blend([[0.40, pc7d], [0.30, pc14d], [0.30, pc30d]])

  let trend = null
  if (prices.length >= 10) {
    const { slope, r2 } = linreg(prices.map((p) => Math.log(p)))
    trend = slope * r2 * 1000
  }
  const res = prices.length ? maxDD(prices) : null
  const liq = Number.isFinite(coin.total_volume) ? Math.log(coin.total_volume + 1) : null
  const beta = btcReturns && rets.length >= 2 ? betaOf(rets, btcReturns) : null
  const muAnn = pc30d != null ? Math.log(1 + pc30d / 100) * (365 / 30) : null

  return { volAnn, momS, momL, trend, res, liq, beta, muAnn, returns: rets }
}

// ------------------------------------------------------ equity primitives ---

// r(n): simple return over the last n bars, in PERCENT; null if too short.
export function windowReturn(closes, n) {
  const last = closes.length - 1
  const i = last - n
  if (i < 0 || !(closes[i] > 0)) return null
  return (closes[last] / closes[i] - 1) * 100
}

// row: { closes, volumes } ≈ 1y of dailies. spyReturns: SPY daily log returns.
export function equityPrimitives(row, spyReturns) {
  const closes = row.closes
  const rets = logRet(closes)
  const volAnn = rets.length >= 2 ? std(rets) * Math.sqrt(252) : null

  const r1w = windowReturn(closes, 5)
  const r1m = windowReturn(closes, 21)
  const r3m = windowReturn(closes, 63)
  const r6m = windowReturn(closes, 126)
  const r1y = windowReturn(closes, 251)

  const momS = blend([[0.5, r1w], [0.5, r1m]])
  const momL = blend([[0.34, r3m], [0.33, r6m], [0.33, r1y]])

  let trend = null
  const tail = closes.slice(-126).filter((v) => v > 0)
  if (tail.length >= 10) {
    const { slope, r2 } = linreg(tail.map((p) => Math.log(p)))
    trend = slope * r2 * 1000
  }
  const res = closes.length ? maxDD(closes) : null

  let liq = null
  if (row.volumes && row.volumes.length === closes.length) {
    const dollar = closes.map((c, i) => c * (row.volumes[i] || 0))
    const m = mean(dollar)
    if (Number.isFinite(m)) liq = Math.log(m + 1)
  }
  const beta = spyReturns ? betaOf(rets, spyReturns) : null
  const muAnn = r1y != null ? Math.log(1 + r1y / 100) : null

  return { volAnn, momS, momL, trend, res, liq, beta, muAnn, r1w, r1m, r3m, r6m, r1y, returns: rets }
}

// ---------------------------------------------------- snapshot primitives ---

// Transparent proxies from the static snapshot's summary fields — no series,
// so trend is proxied by medium-horizon returns and liq by avg dollar volume.
export function stockSnapPrimitives(row) {
  const momS = blend([[0.5, row.r1w], [0.5, row.r1m]])
  const momL = blend([[0.34, row.r3m], [0.33, row.r6m], [0.33, row.r1y]])
  const trend = Number.isFinite(row.r3m) && Number.isFinite(row.r6m) ? (row.r3m + row.r6m) / 2 : null
  const res = finiteOr(row.maxDD)
  const liq = Number.isFinite(row.dollarVol) ? Math.log(row.dollarVol + 1) : null
  const volAnn = finiteOr(row.volAnn)
  const beta = finiteOr(row.beta)
  const muAnn = Number.isFinite(row.r1y) ? Math.log(1 + row.r1y / 100) : null
  return { volAnn, momS, momL, trend, res, liq, beta, muAnn, returns: null }
}

// ------------------------------------------------------------------ ranking ---

/**
 * Rank a universe of assets.
 * assets: [{ id, symbol, name, price, recentPct, prim, ... }]
 * weights: { mom, vol, liq, trend, res, beta } (0–50 each)
 * config: { volSign, momKey }
 * Returns assets sorted desc by composite, each with { z: {factor: z}, composite, rank }.
 */
export function rankAssets(assets, weights, { volSign, momKey }) {
  if (!assets || assets.length === 0) return []
  const signs = { mom: 1, vol: volSign, liq: 1, trend: 1, res: 1, beta: 1 }
  const raw = {}
  for (const k of FACTOR_KEYS) {
    raw[k] = assets.map((a) => {
      const v = k === 'mom' ? a.prim[momKey] : a.prim[k === 'vol' ? 'volAnn' : k]
      return Number.isFinite(v) ? v : null
    })
  }
  const zs = {}
  for (const k of FACTOR_KEYS) zs[k] = zscore(raw[k])

  const totalW = FACTOR_KEYS.reduce((s, k) => s + (weights[k] || 0), 0)
  const ranked = assets.map((a, i) => {
    const z = {}
    let comp = 0
    for (const k of FACTOR_KEYS) {
      z[k] = zs[k][i]
      comp += (weights[k] || 0) * z[k] * signs[k]
    }
    return { ...a, z, composite: totalW > 0 ? comp / totalW : 0 }
  })
  ranked.sort((a, b) => b.composite - a.composite)
  return ranked.map((a, i) => ({ ...a, rank: i + 1 }))
}
