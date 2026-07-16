import { describe, it, expect } from 'vitest'
import { mean, std, logRet, linreg, pearson, betaOf, maxDD, zscore, simulateGBM } from './math.js'

describe('linreg', () => {
  it('recovers a perfect line', () => {
    // y = 2x + 1 for x = 0..3
    const { slope, intercept, r2 } = linreg([1, 3, 5, 7])
    expect(slope).toBeCloseTo(2, 10)
    expect(intercept).toBeCloseTo(1, 10)
    expect(r2).toBeCloseTo(1, 10)
  })

  it('matches known noisy values', () => {
    // hand-computed OLS for [1, 2, 1.5, 3.5, 3]: slope = 0.55, mean-anchored intercept
    const ys = [1, 2, 1.5, 3.5, 3]
    const { slope, intercept, r2 } = linreg(ys)
    expect(slope).toBeCloseTo(0.55, 10)
    expect(intercept).toBeCloseTo(mean(ys) - 0.55 * 2, 10)
    expect(r2).toBeGreaterThan(0)
    expect(r2).toBeLessThan(1)
  })

  it('is flat on constant input with r2 = 0', () => {
    const { slope, r2 } = linreg([4, 4, 4, 4])
    expect(slope).toBe(0)
    expect(r2).toBe(0)
  })
})

describe('betaOf', () => {
  it('is 1 against itself', () => {
    const x = [0.01, -0.02, 0.005, 0.03, -0.01, 0.002]
    expect(betaOf(x, x)).toBeCloseTo(1, 10)
  })

  it('scales linearly', () => {
    const bench = [0.01, -0.02, 0.005, 0.03, -0.01]
    const asset = bench.map((v) => 2 * v)
    expect(betaOf(asset, bench)).toBeCloseTo(2, 10)
  })

  it('returns null on zero-variance benchmark', () => {
    expect(betaOf([1, 2, 3], [5, 5, 5])).toBeNull()
  })
})

describe('zscore', () => {
  it('outputs mean ≈ 0 and sd ≈ 1', () => {
    const zs = zscore([3, 7, 1, 9, 4, 6, 2])
    expect(mean(zs)).toBeCloseTo(0, 10)
    expect(std(zs)).toBeCloseTo(1, 10)
  })

  it('maps missing values to 0 (neutral)', () => {
    const zs = zscore([1, null, 3, undefined, 5, NaN])
    expect(zs[1]).toBe(0)
    expect(zs[3]).toBe(0)
    expect(zs[5]).toBe(0)
    expect(zs[0]).toBeLessThan(0)
    expect(zs[4]).toBeGreaterThan(0)
  })

  it('is all zeros when sd is 0', () => {
    expect(zscore([2, 2, 2])).toEqual([0, 0, 0])
  })
})

describe('maxDD', () => {
  it('finds the deepest peak-to-trough drop on a crafted series', () => {
    // peak 100 → trough 60 = -40%, later peak 120 → 90 = -25%; max DD is -40%
    const prices = [80, 100, 90, 60, 110, 120, 90, 100]
    expect(maxDD(prices)).toBeCloseTo(-0.4, 10)
  })

  it('is 0 for a monotonically rising series', () => {
    expect(maxDD([1, 2, 3, 4])).toBe(0)
  })
})

describe('logRet / pearson', () => {
  it('computes log returns and perfect correlation', () => {
    const a = [100, 110, 99, 121]
    const rets = logRet(a)
    expect(rets).toHaveLength(3)
    expect(rets[0]).toBeCloseTo(Math.log(1.1), 10)
    expect(pearson(rets, rets)).toBeCloseTo(1, 10)
  })

  it('detects perfect anticorrelation', () => {
    const x = [0.01, -0.02, 0.03, -0.01]
    const y = x.map((v) => -v)
    expect(pearson(x, y)).toBeCloseTo(-1, 10)
  })
})

describe('simulateGBM', () => {
  it('keeps percentiles strictly ordered at day 30', () => {
    const fan = simulateGBM(100, 0.5, 0.6, { days: 30, paths: 300 })
    expect(fan).toHaveLength(31)
    const last = fan[30]
    expect(last.p5).toBeLessThan(last.p25)
    expect(last.p25).toBeLessThan(last.p50)
    expect(last.p50).toBeLessThan(last.p75)
    expect(last.p75).toBeLessThan(last.p95)
  })

  it('starts every percentile at spot on day 0', () => {
    const fan = simulateGBM(42, 0.1, 0.3)
    expect(fan[0].p5).toBe(42)
    expect(fan[0].p95).toBe(42)
  })

  it('clamps insane drift instead of exploding', () => {
    const fan = simulateGBM(100, 50, 0.2, { days: 30, paths: 100 })
    // μ clamped to 2.0 → E[S30] ≈ 100·e^(2·30/365) ≈ 118, far below e^(50·30/365)
    expect(fan[30].p50).toBeLessThan(400)
  })

  it('returns empty for invalid spot', () => {
    expect(simulateGBM(0, 0.1, 0.2)).toEqual([])
  })
})
