// Pure math utilities. No DOM, no fetch — unit-tested with Vitest.

export function mean(a) {
  if (!a || a.length === 0) return NaN
  let s = 0
  for (const v of a) s += v
  return s / a.length
}

// Sample standard deviation (n-1).
export function std(a) {
  if (!a || a.length < 2) return 0
  const m = mean(a)
  let s = 0
  for (const v of a) s += (v - m) * (v - m)
  return Math.sqrt(s / (a.length - 1))
}

// Log returns of a price series; skips non-positive prices.
export function logRet(prices) {
  const out = []
  for (let i = 1; i < prices.length; i++) {
    const a = prices[i - 1]
    const b = prices[i]
    if (a > 0 && b > 0) out.push(Math.log(b / a))
  }
  return out
}

// OLS of ys against x = 0..n-1. Returns { slope, intercept, r2 }.
export function linreg(ys) {
  const n = ys.length
  if (n < 2) return { slope: 0, intercept: n ? ys[0] : 0, r2: 0 }
  const mx = (n - 1) / 2
  const my = mean(ys)
  let sxy = 0
  let sxx = 0
  let syy = 0
  for (let i = 0; i < n; i++) {
    const dx = i - mx
    const dy = ys[i] - my
    sxy += dx * dy
    sxx += dx * dx
    syy += dy * dy
  }
  const slope = sxx === 0 ? 0 : sxy / sxx
  const intercept = my - slope * mx
  const r2 = syy === 0 ? 0 : (sxy * sxy) / (sxx * syy)
  return { slope, intercept, r2 }
}

// Pearson correlation of two equal-interest series (truncated to min length).
export function pearson(a, b) {
  const n = Math.min(a.length, b.length)
  if (n < 2) return 0
  const xa = a.slice(a.length - n)
  const xb = b.slice(b.length - n)
  const ma = mean(xa)
  const mb = mean(xb)
  let sab = 0
  let saa = 0
  let sbb = 0
  for (let i = 0; i < n; i++) {
    const da = xa[i] - ma
    const db = xb[i] - mb
    sab += da * db
    saa += da * da
    sbb += db * db
  }
  const den = Math.sqrt(saa * sbb)
  return den === 0 ? 0 : sab / den
}

// Beta of asset returns vs benchmark returns: cov(a, bench) / var(bench).
export function betaOf(assetRets, benchRets) {
  const n = Math.min(assetRets.length, benchRets.length)
  if (n < 2) return null
  const xa = assetRets.slice(assetRets.length - n)
  const xb = benchRets.slice(benchRets.length - n)
  const ma = mean(xa)
  const mb = mean(xb)
  let cov = 0
  let varb = 0
  for (let i = 0; i < n; i++) {
    cov += (xa[i] - ma) * (xb[i] - mb)
    varb += (xb[i] - mb) * (xb[i] - mb)
  }
  return varb === 0 ? null : cov / varb
}

// Maximum drawdown of a price series. Returns ≤ 0 (e.g. -0.34 = -34%).
export function maxDD(prices) {
  if (!prices || prices.length === 0) return 0
  let peak = prices[0]
  let dd = 0
  for (const p of prices) {
    if (p > peak) peak = p
    if (peak > 0) dd = Math.min(dd, (p - peak) / peak)
  }
  return dd
}

// Z-scores of an array that may contain null/undefined/NaN.
// Missing values map to 0 (neutral); if sd is 0 everything is 0.
export function zscore(values) {
  const clean = values.filter((v) => v != null && Number.isFinite(v))
  if (clean.length < 2) return values.map(() => 0)
  const m = mean(clean)
  const sd = std(clean)
  if (sd === 0) return values.map(() => 0)
  return values.map((v) => (v != null && Number.isFinite(v) ? (v - m) / sd : 0))
}

// Standard normal via Box–Muller (with cached spare).
let spare = null
export function gaussian(rng = Math.random) {
  if (spare != null) {
    const v = spare
    spare = null
    return v
  }
  let u = 0
  let v = 0
  while (u === 0) u = rng()
  while (v === 0) v = rng()
  const r = Math.sqrt(-2 * Math.log(u))
  const t = 2 * Math.PI * v
  spare = r * Math.sin(t)
  return r * Math.cos(t)
}

function percentile(sorted, p) {
  const idx = (sorted.length - 1) * p
  const lo = Math.floor(idx)
  const hi = Math.ceil(idx)
  if (lo === hi) return sorted[lo]
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (idx - lo)
}

// GBM Monte Carlo: dS = μS·dt + σS·dW, Euler steps, dt = 1/365.
// μ clamped to ±2.0, σ floored at 0.01. Returns one row per day
// { day, p5, p25, p50, p75, p95 } including day 0 (= spot).
export function simulateGBM(spot, muAnn, sigmaAnn, { days = 30, paths = 300, rng = Math.random } = {}) {
  if (!(spot > 0)) return []
  const mu = Math.max(-2, Math.min(2, Number.isFinite(muAnn) ? muAnn : 0))
  const sigma = Math.max(0.01, Number.isFinite(sigmaAnn) ? sigmaAnn : 0.01)
  const dt = 1 / 365
  const sqdt = Math.sqrt(dt)
  // grid[d][p] = price of path p at day d
  const grid = []
  const prices = new Array(paths).fill(spot)
  grid.push(prices.slice())
  for (let d = 1; d <= days; d++) {
    for (let p = 0; p < paths; p++) {
      const S = prices[p]
      const next = S + mu * S * dt + sigma * S * sqdt * gaussian(rng)
      prices[p] = Math.max(next, 0.0000001)
    }
    grid.push(prices.slice())
  }
  return grid.map((row, day) => {
    const sorted = row.slice().sort((a, b) => a - b)
    return {
      day,
      p5: percentile(sorted, 0.05),
      p25: percentile(sorted, 0.25),
      p50: percentile(sorted, 0.5),
      p75: percentile(sorted, 0.75),
      p95: percentile(sorted, 0.95),
    }
  })
}
