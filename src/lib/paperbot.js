// Paper trading bot — SIMULATED money only.
// It equal-weights the current Top 5 by composite score, pays a fee on every
// trade, and marks itself to market against a buy-and-hold benchmark.
// There is no strategy that "makes money with no fail"; this module exists to
// measure honestly whether the ranking would have made or lost fake money.

export const START_CASH = 10000
export const FEE_RATE = 0.001 // 10 bps per side — optimistic for crypto, typical for retail
export const REBALANCE_DRIFT = 0.02 // ignore position drift under 2% of equity
export const MIN_TICK_MS = 10_000 // collapse history points closer than this
export const MIN_AUTO_REBALANCE_MS = 60_000
export const MAX_HISTORY = 600
export const MAX_TRADES = 200

export function createBot(now, benchSymbol, benchPrice) {
  return {
    running: true,
    startCash: START_CASH,
    cash: START_CASH,
    positions: {}, // symbol -> { qty, avgCost, lastPrice }
    trades: [], // { t, side, symbol, qty, price, fee }
    history: [{ t: now, equity: START_CASH, bench: START_CASH }],
    feesPaid: 0,
    createdAt: now,
    lastRebalance: null,
    bench: benchSymbol && benchPrice > 0 ? { symbol: benchSymbol, entry: benchPrice } : null,
  }
}

export function botEquity(bot, prices = {}) {
  let v = bot.cash
  for (const [sym, pos] of Object.entries(bot.positions)) {
    const px = Number.isFinite(prices[sym]) ? prices[sym] : pos.lastPrice
    if (Number.isFinite(px)) v += pos.qty * px
  }
  return v
}

export function benchEquity(bot, prices = {}) {
  if (!bot.bench) return null
  const px = prices[bot.bench.symbol]
  if (Number.isFinite(px) && px > 0) return bot.startCash * (px / bot.bench.entry)
  const last = bot.history[bot.history.length - 1]
  return last?.bench ?? null
}

function execute(bot, side, symbol, qty, price, now) {
  if (!(qty > 0) || !(price > 0)) return
  const gross = qty * price
  const fee = gross * FEE_RATE
  if (side === 'BUY') {
    const cost = gross + fee
    if (cost > bot.cash + 1e-9) return
    bot.cash -= cost
    if (bot.cash < 0 && bot.cash > -1e-6) bot.cash = 0 // fp residue from spending exactly all cash
    const pos = bot.positions[symbol] || { qty: 0, avgCost: 0, lastPrice: price }
    pos.avgCost = (pos.avgCost * pos.qty + gross) / (pos.qty + qty)
    pos.qty += qty
    pos.lastPrice = price
    bot.positions[symbol] = pos
  } else {
    const pos = bot.positions[symbol]
    if (!pos || pos.qty < qty * (1 - 1e-9)) return
    bot.cash += gross - fee
    pos.qty -= qty
    pos.lastPrice = price
    if (pos.qty * price < 0.01) delete bot.positions[symbol]
  }
  bot.feesPaid += fee
  bot.trades.push({ t: now, side, symbol, qty, price, fee })
  if (bot.trades.length > MAX_TRADES) bot.trades.splice(0, bot.trades.length - MAX_TRADES)
}

// Do the holdings differ from the target set? (positions we can't price are held)
export function needsRebalance(bot, targetSymbols) {
  const held = Object.keys(bot.positions).sort().join(',')
  const want = [...targetSymbols].sort().join(',')
  return held !== want
}

/**
 * Rebalance into an equal-weight basket of targetSymbols at current prices.
 * Pure-ish: returns a NEW bot object; the input is not mutated.
 * Symbols without a live price are skipped (never traded blind).
 */
export function rebalance(prevBot, targetSymbols, prices, now) {
  const bot = structuredClone(prevBot)
  const tradable = targetSymbols.filter((s) => Number.isFinite(prices[s]) && prices[s] > 0)
  if (tradable.length === 0) return bot

  // 1) liquidate positions that fell out of the target set (only with a price)
  for (const sym of Object.keys(bot.positions)) {
    if (!tradable.includes(sym) && Number.isFinite(prices[sym]) && prices[sym] > 0) {
      execute(bot, 'SELL', sym, bot.positions[sym].qty, prices[sym], now)
    }
  }

  const equity = botEquity(bot, prices)
  const target = equity / tradable.length
  const value = (sym) => (bot.positions[sym]?.qty || 0) * prices[sym]

  // 2) trim overweights first so cash is free for the buys
  for (const sym of tradable) {
    const excess = value(sym) - target
    if (excess > equity * REBALANCE_DRIFT) execute(bot, 'SELL', sym, excess / prices[sym], prices[sym], now)
  }
  // 3) top up underweights with whatever cash allows
  for (const sym of tradable) {
    const deficit = target - value(sym)
    if (deficit > equity * REBALANCE_DRIFT) {
      const spend = Math.min(deficit, bot.cash / (1 + FEE_RATE))
      if (spend > 0) execute(bot, 'BUY', sym, spend / prices[sym], prices[sym], now)
    }
  }
  bot.lastRebalance = now
  return bot
}

// Mark to market and append an equity-curve point. Returns a NEW bot.
export function recordTick(prevBot, prices, now) {
  const bot = structuredClone(prevBot)
  for (const [sym, pos] of Object.entries(bot.positions)) {
    if (Number.isFinite(prices[sym]) && prices[sym] > 0) pos.lastPrice = prices[sym]
  }
  const point = { t: now, equity: botEquity(bot, prices), bench: benchEquity(bot, prices) }
  const last = bot.history[bot.history.length - 1]
  if (last && now - last.t < MIN_TICK_MS) {
    bot.history[bot.history.length - 1] = point
  } else {
    bot.history.push(point)
    if (bot.history.length > MAX_HISTORY) bot.history.splice(0, bot.history.length - MAX_HISTORY)
  }
  return bot
}

export function botStats(bot, prices) {
  const equity = botEquity(bot, prices)
  const totalReturn = (equity / bot.startCash - 1) * 100
  const bench = benchEquity(bot, prices)
  const benchReturn = bench != null ? (bench / bot.startCash - 1) * 100 : null
  // max drawdown of the bot's own equity curve
  let peak = -Infinity
  let dd = 0
  for (const h of bot.history) {
    if (h.equity > peak) peak = h.equity
    if (peak > 0) dd = Math.min(dd, (h.equity - peak) / peak)
  }
  return { equity, totalReturn, benchReturn, maxDD: dd, feesPaid: bot.feesPaid, tradeCount: bot.trades.length }
}
