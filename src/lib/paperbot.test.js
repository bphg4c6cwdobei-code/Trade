import { describe, it, expect } from 'vitest'
import {
  createBot, rebalance, recordTick, needsRebalance, botEquity, botStats,
  START_CASH, FEE_RATE,
} from './paperbot.js'

const T0 = 1_700_000_000_000
const PRICES = { AAA: 10, BBB: 20, CCC: 5, DDD: 100, EEE: 2, BTC: 50000 }
const TOP5 = ['AAA', 'BBB', 'CCC', 'DDD', 'EEE']

describe('paperbot', () => {
  it('rebalances a fresh bot into 5 roughly equal positions, conserving value minus fees', () => {
    const bot = rebalance(createBot(T0, 'BTC', PRICES.BTC), TOP5, PRICES, T0)
    expect(Object.keys(bot.positions).sort()).toEqual(TOP5.slice().sort())
    const equity = botEquity(bot, PRICES)
    // value is conserved except for fees: equity + feesPaid ≈ START_CASH
    expect(equity + bot.feesPaid).toBeCloseTo(START_CASH, 6)
    expect(bot.feesPaid).toBeGreaterThan(0)
    expect(bot.feesPaid).toBeLessThan(START_CASH * FEE_RATE * 1.5)
    // each position ≈ 20% of equity
    for (const sym of TOP5) {
      const w = (bot.positions[sym].qty * PRICES[sym]) / equity
      expect(w).toBeGreaterThan(0.15)
      expect(w).toBeLessThan(0.25)
    }
    // never trades money it does not have
    expect(bot.cash).toBeGreaterThanOrEqual(0)
  })

  it('liquidates positions that drop out of the target set', () => {
    let bot = rebalance(createBot(T0, 'BTC', PRICES.BTC), TOP5, PRICES, T0)
    const newTop = ['AAA', 'BBB', 'CCC', 'DDD', 'BTC']
    bot = rebalance(bot, newTop, PRICES, T0 + 60_000)
    expect(bot.positions.EEE).toBeUndefined()
    expect(bot.positions.BTC).toBeDefined()
    expect(bot.trades.some((t) => t.side === 'SELL' && t.symbol === 'EEE')).toBe(true)
  })

  it('never trades a symbol without a live price', () => {
    const bot = rebalance(createBot(T0, 'BTC', PRICES.BTC), ['AAA', 'GHOST'], { AAA: 10 }, T0)
    expect(bot.positions.GHOST).toBeUndefined()
    expect(bot.trades.every((t) => t.symbol !== 'GHOST')).toBe(true)
  })

  it('needsRebalance detects a changed top-5 set', () => {
    const bot = rebalance(createBot(T0, 'BTC', PRICES.BTC), TOP5, PRICES, T0)
    expect(needsRebalance(bot, TOP5)).toBe(false)
    expect(needsRebalance(bot, ['AAA', 'BBB', 'CCC', 'DDD', 'BTC'])).toBe(true)
  })

  it('marks to market and reports losses honestly', () => {
    let bot = rebalance(createBot(T0, 'BTC', PRICES.BTC), TOP5, PRICES, T0)
    bot = recordTick(bot, PRICES, T0)
    // everything halves
    const crashed = Object.fromEntries(Object.entries(PRICES).map(([k, v]) => [k, v / 2]))
    bot = recordTick(bot, crashed, T0 + 60_000)
    const stats = botStats(bot, crashed)
    expect(stats.totalReturn).toBeLessThan(-45)
    expect(stats.maxDD).toBeLessThan(-0.45)
    // benchmark halves too
    expect(stats.benchReturn).toBeCloseTo(-50, 5)
  })

  it('collapses rapid ticks but keeps spaced ones', () => {
    let bot = rebalance(createBot(T0, 'BTC', PRICES.BTC), TOP5, PRICES, T0)
    const len0 = bot.history.length
    bot = recordTick(bot, PRICES, T0 + 1_000) // < MIN_TICK_MS → replaces
    expect(bot.history.length).toBe(len0)
    bot = recordTick(bot, PRICES, T0 + 61_000) // spaced → appends
    expect(bot.history.length).toBe(len0 + 1)
  })

  it('does not mutate the input bot', () => {
    const original = createBot(T0, 'BTC', PRICES.BTC)
    const snapshot = JSON.stringify(original)
    rebalance(original, TOP5, PRICES, T0)
    recordTick(original, PRICES, T0)
    expect(JSON.stringify(original)).toBe(snapshot)
  })
})
