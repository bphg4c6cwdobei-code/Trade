import React, { useEffect, useState } from 'react'
import { Area, AreaChart, ResponsiveContainer, Tooltip, YAxis } from 'recharts'
import { T, FONTS, S, fmtNum } from '../theme.js'
import { loadVix } from '../lib/loaders.js'

// VIX context card — proof of the GitHub-raw CORS pattern.
// Hides silently on failure.
export default function VixCard() {
  const [vix, setVix] = useState(null)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    const ctrl = new AbortController()
    loadVix(ctrl.signal)
      .then(setVix)
      .catch((e) => {
        if (e?.name !== 'AbortError') setFailed(true)
      })
    return () => ctrl.abort()
  }, [])

  if (failed || !vix) return null

  const level = vix.last.close
  const color = level < 18 ? T.green : level < 25 ? T.amber : T.red
  const delta = level - vix.prev.close

  return (
    <section style={{ ...S.panel, ...S.fadeIn, padding: 16, marginBottom: 16, display: 'flex', gap: 18, alignItems: 'center', flexWrap: 'wrap' }}>
      <div style={{ minWidth: 150 }}>
        <div style={S.label}>vix · volatility context</div>
        <div style={{ fontFamily: FONTS.mono, fontSize: 30, fontWeight: 600, color, fontVariantNumeric: 'tabular-nums' }}>
          {fmtNum(level, 2)}
        </div>
        <div style={{ ...S.mono, fontSize: 12, color: delta >= 0 ? T.red : T.green }}>
          {delta >= 0 ? '▲' : '▼'} {fmtNum(Math.abs(delta), 2)} vs prior day
        </div>
        <div style={{ fontSize: 10, color: T.faint, marginTop: 4 }}>{vix.last.date}</div>
      </div>
      <div style={{ flex: 1, minWidth: 220, height: 64 }}>
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={vix.series} margin={{ top: 4, right: 0, bottom: 0, left: 0 }}>
            <defs>
              <linearGradient id="vixFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={color} stopOpacity={0.28} />
                <stop offset="100%" stopColor={color} stopOpacity={0} />
              </linearGradient>
            </defs>
            <YAxis domain={['dataMin', 'dataMax']} hide />
            <Tooltip
              contentStyle={{ background: T.panel2, border: `1px solid ${T.line}`, borderRadius: 6, fontFamily: FONTS.mono, fontSize: 11 }}
              labelStyle={{ color: T.dim }}
              itemStyle={{ color: T.ink }}
              formatter={(v) => [fmtNum(v, 2), 'VIX close']}
              labelFormatter={(_, payload) => payload?.[0]?.payload?.date || ''}
            />
            <Area type="monotone" dataKey="close" stroke={color} strokeWidth={2} fill="url(#vixFill)" dot={false} isAnimationActive={false} />
          </AreaChart>
        </ResponsiveContainer>
      </div>
      <div style={{ width: '100%', fontSize: 10, color: T.faint }}>
        90-day CBOE VIX closes · data: datasets/finance-vix (GitHub) — fetched directly from raw.githubusercontent.com, no proxy needed.
      </div>
    </section>
  )
}
