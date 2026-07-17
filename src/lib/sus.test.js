import { describe, it, expect } from 'vitest'
import { cryptoSusRaw, equitySusRaw, computeSusScores, susLevel } from './sus.js'
import {
  parseEdgarCount, parsePoliticianFeed, parseBlockchainInfoTxs, parseMempoolRecent,
} from './susLoaders.js'

const NOW = Date.parse('2026-07-17T00:00:00Z')

function coin({ volume = 1e8, mcap = 1e10, pc24 = 1, spark } = {}) {
  return {
    total_volume: volume,
    market_cap: mcap,
    price_change_percentage_24h_in_currency: pc24,
    sparkline_in_7d: { price: spark || Array.from({ length: 168 }, (_, i) => 100 + Math.sin(i / 5)) },
  }
}

describe('cryptoSusRaw', () => {
  it('computes turnover and divergence', () => {
    const raw = cryptoSusRaw(coin({ volume: 2e9, mcap: 1e10, pc24: 0.5 }))
    expect(raw.turnover).toBeCloseTo(0.2, 10)
    expect(raw.diverge).toBeCloseTo(0.2 / 1.5, 10)
    expect(raw.pump).toBeCloseTo(0.5, 10)
  })

  it('detects a volatility regime spike in the last 24h', () => {
    const calm = Array.from({ length: 144 }, (_, i) => 100 + 0.05 * Math.sin(i))
    const wild = Array.from({ length: 24 }, (_, i) => 100 + 8 * Math.sin(i * 2.3))
    const raw = cryptoSusRaw(coin({ spark: [...calm, ...wild] }))
    expect(raw.regime).toBeGreaterThan(1.5)
  })

  it('is null-safe on missing fields', () => {
    const raw = cryptoSusRaw({ sparkline_in_7d: { price: [] } })
    expect(raw.turnover).toBeNull()
    expect(raw.regime).toBeNull()
    expect(raw.diverge).toBeNull()
  })
})

describe('equitySusRaw', () => {
  it('flags a 10x recent volume surge with flat price as divergence', () => {
    const closes = Array.from({ length: 260 }, (_, i) => 100 + 0.3 * Math.sin(i / 3))
    const volumes = closes.map((_, i) => (i >= 255 ? 1e7 : 1e6))
    const raw = equitySusRaw({ closes, volumes })
    expect(raw.volSurge).toBeGreaterThan(2) // ln(10) ≈ 2.3
    expect(raw.diverge).toBeGreaterThan(1)
  })

  it('flags a single-day move spike', () => {
    const closes = Array.from({ length: 260 }, (_, i) => 100 + 0.2 * Math.sin(i))
    closes[258] = closes[257] * 1.25 // +25% day in a sleepy series
    const volumes = closes.map(() => 1e6)
    const raw = equitySusRaw({ closes, volumes })
    expect(raw.moveSpike).toBeGreaterThan(5)
  })

  it('returns nulls on short series', () => {
    const raw = equitySusRaw({ closes: [1, 2, 3], volumes: [1, 1, 1] })
    expect(raw.volSurge).toBeNull()
  })
})

describe('computeSusScores', () => {
  const universe = (outlierIdx) =>
    Array.from({ length: 8 }, (_, i) => ({
      symbol: `C${i}`,
      susRaw:
        i === outlierIdx
          ? { turnover: 2.0, diverge: 1.8, regime: 3, pump: 1 }
          : { turnover: 0.05, diverge: 0.04, regime: 1, pump: 1 },
    }))

  it('ranks the planted anomaly on top with a non-normal level', () => {
    const scores = computeSusScores(universe(3), 'crypto')
    const sorted = Object.entries(scores).sort((a, b) => b[1].score - a[1].score)
    expect(sorted[0][0]).toBe('C3')
    expect(scores.C3.level).not.toBe('normal')
    expect(scores.C0.level).toBe('normal')
  })

  it('excludes an absent overlay source entirely (missing ≠ zero evidence)', () => {
    const scores = computeSusScores(
      [{ symbol: 'AAA', susRaw: { volSurge: 1, moveSpike: 1, diverge: 1 } }],
      'stocks',
    )
    expect(scores.AAA.signals.insider).toBeUndefined()
    expect(scores.AAA.signals.politician).toBeUndefined()
  })

  it('folds insider filing counts in when the overlay is present', () => {
    const assets = [
      { symbol: 'AAA', susRaw: { volSurge: 0, moveSpike: 0, diverge: 0 } },
      { symbol: 'BBB', susRaw: { volSurge: 0, moveSpike: 0, diverge: 0 } },
      { symbol: 'CCC', susRaw: { volSurge: 0, moveSpike: 0, diverge: 0 } },
    ]
    const scores = computeSusScores(assets, 'stocks', { insider: { AAA: 40, BBB: 2, CCC: 1 } })
    expect(scores.AAA.signals.insider).toBeGreaterThan(scores.BBB.signals.insider)
    expect(scores.AAA.score).toBeGreaterThan(scores.CCC.score)
  })

  it('maps score to levels at the documented thresholds', () => {
    expect(susLevel(2)).toBe('high')
    expect(susLevel(1)).toBe('elevated')
    expect(susLevel(0.2)).toBe('normal')
  })
})

describe('overlay parsers', () => {
  it('parses both EDGAR hit-count shapes', () => {
    expect(parseEdgarCount(JSON.stringify({ hits: { total: { value: 12 } } }))).toBe(12)
    expect(parseEdgarCount(JSON.stringify({ hits: { total: 7 } }))).toBe(7)
    expect(() => parseEdgarCount('{}')).toThrow()
  })

  it('parses a politician feed, windowing to 90 days and counting per ticker', () => {
    const feed = {
      updated: '2026-07-16T00:00:00Z',
      trades: [
        { ticker: 'NVDA', chamber: 'house', name: 'Rep. A', side: 'buy', date: '2026-07-01', amount: '$1,001 - $15,000' },
        { ticker: 'nvda', chamber: 'senate', name: 'Sen. B', side: 'sell', date: '2026-06-20', amount: '$15,001 - $50,000' },
        { ticker: 'MSFT', chamber: 'house', name: 'Rep. C', side: 'buy', date: '2025-01-01', amount: '$1,001 - $15,000' }, // stale
      ],
    }
    const parsed = parsePoliticianFeed(JSON.stringify(feed), { now: NOW })
    expect(parsed.bySymbol.NVDA).toBe(2)
    expect(parsed.bySymbol.MSFT).toBeUndefined()
    expect(parsed.recent[0].ticker).toBe('NVDA')
  })

  it('parses blockchain.info and mempool.space transaction shapes', () => {
    const bi = { txs: [{ hash: 'aa', time: 1750000000, out: [{ value: 6e8 }, { value: 1e8 }] }] }
    const parsedBi = parseBlockchainInfoTxs(JSON.stringify(bi))
    expect(parsedBi[0].btc).toBeCloseTo(7, 10)
    const mp = [{ txid: 'bb', fee: 1000, vsize: 200, value: 12e8 }]
    const parsedMp = parseMempoolRecent(JSON.stringify(mp))
    expect(parsedMp[0].btc).toBeCloseTo(12, 10)
  })
})
