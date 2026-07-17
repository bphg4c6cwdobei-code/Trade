import React from 'react'
import { Bot, Pause, Play, RefreshCcw, Trash2 } from 'lucide-react'
import { Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { T, FONTS, S, fmtPrice, fmtNum } from '../theme.js'
import { botStats, START_CASH, FEE_RATE } from '../lib/paperbot.js'

const btn = {
  display: 'inline-flex', alignItems: 'center', gap: 6, padding: '7px 14px',
  background: 'transparent', color: T.dim, border: `1px solid ${T.line}`,
  borderRadius: 6, fontFamily: FONTS.mono, fontSize: 11, cursor: 'pointer',
}

function Stat({ label, value, color }) {
  return (
    <div style={{ minWidth: 100 }}>
      <div style={S.label}>{label}</div>
      <div style={{ ...S.mono, fontSize: 16, fontWeight: 600, color: color || T.ink }}>{value}</div>
    </div>
  )
}

export default function PaperBot({ bot, prices, topSymbols, onStart, onToggle, onRebalance, onReset }) {
  const stats = bot ? botStats(bot, prices) : null
  const retColor = (v) => (v == null ? T.faint : v >= 0 ? T.green : T.red)

  return (
    <section style={{ ...S.panel, ...S.fadeIn, padding: 16, marginBottom: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
        <h2 style={{ ...S.h2, display: 'flex', alignItems: 'center', gap: 8 }}>
          <Bot size={15} color={T.gold} /> Paper trading bot
          <span style={{ ...S.label, fontWeight: 400, color: T.amber }}>· simulated money only</span>
        </h2>
        {bot && (
          <div style={{ display: 'flex', gap: 8 }}>
            <button style={btn} onClick={onToggle}>
              {bot.running ? <Pause size={11} /> : <Play size={11} />} {bot.running ? 'pause' : 'resume'}
            </button>
            <button style={btn} onClick={onRebalance} disabled={!bot.running} title="Rebalance into the current Top 5 now">
              <RefreshCcw size={11} /> rebalance now
            </button>
            <button style={{ ...btn, color: T.red, borderColor: `${T.red}55` }} onClick={onReset}>
              <Trash2 size={11} /> reset
            </button>
          </div>
        )}
      </div>

      <div style={{ fontSize: 12, lineHeight: 1.6, color: T.dim, margin: '10px 0 12px', borderLeft: `2px solid ${T.amber}`, paddingLeft: 10 }}>
        <b style={{ color: T.amber }}>No bot makes money "with no fail" — this one included.</b> It trades fake money
        on the app's own Top-5 composite signal, pays {(FEE_RATE * 100).toFixed(1)}% per trade, and reports its losses
        and drawdowns exactly as they happen. Ranking recent behavior is not predicting returns; expect losing
        stretches. Results also flatter reality: no slippage, no spreads, instant fills.
      </div>

      {!bot && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
          <button
            onClick={onStart}
            style={{ ...btn, background: T.crimsonDeep, color: T.ink, border: `1px solid ${T.crimson}`, padding: '9px 20px', letterSpacing: '0.06em' }}
          >
            START WITH ${START_CASH.toLocaleString()} PAPER CASH
          </button>
          <span style={{ ...S.mono, fontSize: 11, color: T.faint }}>
            equal-weights the current Top 5 ({topSymbols.join(', ') || '—'}), auto-rebalances when the Top 5 changes
          </span>
        </div>
      )}

      {bot && stats && (
        <>
          <div style={{ display: 'flex', gap: 22, flexWrap: 'wrap', marginBottom: 12 }}>
            <Stat label="equity" value={`$${fmtPrice(stats.equity)}`} />
            <Stat label="bot return" value={`${stats.totalReturn >= 0 ? '+' : ''}${stats.totalReturn.toFixed(2)}%`} color={retColor(stats.totalReturn)} />
            <Stat
              label={`buy & hold ${bot.bench?.symbol || ''}`}
              value={stats.benchReturn == null ? '—' : `${stats.benchReturn >= 0 ? '+' : ''}${stats.benchReturn.toFixed(2)}%`}
              color={retColor(stats.benchReturn)}
            />
            <Stat label="max drawdown" value={`${(stats.maxDD * 100).toFixed(2)}%`} color={stats.maxDD < 0 ? T.red : T.dim} />
            <Stat label="fees paid" value={`$${fmtNum(stats.feesPaid, 2)}`} color={T.dim} />
            <Stat label="trades" value={stats.tradeCount} color={T.dim} />
            <Stat label="status" value={bot.running ? 'running' : 'paused'} color={bot.running ? T.green : T.amber} />
          </div>

          {bot.history.length >= 2 && (
            <div style={{ width: '100%', height: 160, marginBottom: 4 }}>
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={bot.history} margin={{ top: 6, right: 8, bottom: 0, left: 4 }}>
                  <XAxis
                    dataKey="t"
                    tickFormatter={(t) => new Date(t).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    tick={{ fontFamily: FONTS.mono, fontSize: 9, fill: T.faint }}
                    tickLine={false}
                    axisLine={{ stroke: T.line }}
                    minTickGap={60}
                  />
                  <YAxis
                    domain={['auto', 'auto']}
                    tick={{ fontFamily: FONTS.mono, fontSize: 9, fill: T.faint }}
                    tickLine={false}
                    axisLine={false}
                    width={62}
                    tickFormatter={(v) => `$${fmtPrice(v)}`}
                  />
                  <Tooltip
                    contentStyle={{ background: T.panel2, border: `1px solid ${T.line}`, borderRadius: 6, fontFamily: FONTS.mono, fontSize: 11 }}
                    labelStyle={{ color: T.dim }}
                    itemStyle={{ color: T.ink }}
                    labelFormatter={(t) => new Date(t).toLocaleString()}
                    formatter={(v, name) => [`$${fmtPrice(v)}`, name === 'equity' ? 'bot' : `buy & hold ${bot.bench?.symbol || ''}`]}
                  />
                  <Line type="monotone" dataKey="equity" stroke={T.gold} strokeWidth={2} dot={false} isAnimationActive={false} />
                  <Line type="monotone" dataKey="bench" stroke={T.violet} strokeWidth={2} strokeDasharray="4 3" dot={false} isAnimationActive={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
          <div style={{ ...S.mono, fontSize: 10, color: T.faint, marginBottom: 12 }}>
            <span style={{ color: T.gold }}>━ bot equity</span> · <span style={{ color: T.violet }}>╌ buy & hold {bot.bench?.symbol || 'benchmark'}</span>
            {' '}· started {new Date(bot.createdAt).toLocaleString()}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 14 }}>
            <div>
              <div style={{ ...S.label, marginBottom: 6 }}>holdings</div>
              {Object.keys(bot.positions).length === 0 && (
                <div style={{ ...S.mono, fontSize: 11, color: T.faint }}>all cash (${fmtPrice(bot.cash)})</div>
              )}
              {Object.entries(bot.positions).map(([sym, pos]) => {
                const px = Number.isFinite(prices[sym]) ? prices[sym] : pos.lastPrice
                const val = pos.qty * px
                const pnl = px / pos.avgCost - 1
                return (
                  <div key={sym} style={{ display: 'flex', justifyContent: 'space-between', gap: 8, ...S.mono, fontSize: 11, padding: '3px 0', borderBottom: `1px solid ${T.line}` }}>
                    <span style={{ color: T.ink, width: 52 }}>{sym}</span>
                    <span style={{ color: T.dim }}>${fmtPrice(val)}</span>
                    <span style={{ color: pnl >= 0 ? T.green : T.red }}>{pnl >= 0 ? '+' : ''}{(pnl * 100).toFixed(2)}%</span>
                  </div>
                )
              })}
              {Object.keys(bot.positions).length > 0 && (
                <div style={{ ...S.mono, fontSize: 11, color: T.faint, paddingTop: 3 }}>cash ${fmtPrice(bot.cash)}</div>
              )}
            </div>
            <div>
              <div style={{ ...S.label, marginBottom: 6 }}>recent trades</div>
              {bot.trades.length === 0 && <div style={{ ...S.mono, fontSize: 11, color: T.faint }}>none yet</div>}
              {bot.trades.slice(-8).reverse().map((tr, i) => (
                <div key={`${tr.t}-${tr.symbol}-${i}`} style={{ display: 'flex', gap: 10, ...S.mono, fontSize: 10, color: T.dim, padding: '3px 0', borderBottom: `1px solid ${T.line}` }}>
                  <span style={{ color: T.faint }}>{new Date(tr.t).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                  <span style={{ color: tr.side === 'BUY' ? T.teal : T.crimson, width: 34 }}>{tr.side}</span>
                  <span style={{ color: T.ink, width: 52 }}>{tr.symbol}</span>
                  <span>@ ${fmtPrice(tr.price)}</span>
                  <span style={{ color: T.faint }}>fee ${fmtNum(tr.fee, 2)}</span>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </section>
  )
}
