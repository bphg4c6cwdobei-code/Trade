import React, { useMemo } from 'react'
import { Area, ComposedChart, Line, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { TrendingUp } from 'lucide-react'
import { T, FONTS, S, fmtPrice } from '../theme.js'
import { simulateGBM } from '../lib/math.js'

// GBM Monte Carlo fan for the selected asset (series modes only).
// This is a model band, NOT a forecast.
export default function ProjectionChart({ asset }) {
  const fan = useMemo(() => {
    if (!asset || !(asset.price > 0)) return null
    const rows = simulateGBM(asset.price, asset.prim.muAnn ?? 0, asset.prim.volAnn ?? 0.01, { days: 30, paths: 300 })
    // Range areas: recharts renders [low, high] arrays as bands.
    return rows.map((r) => ({
      day: r.day,
      outer: [r.p5, r.p95],
      inner: [r.p25, r.p75],
      median: r.p50,
    }))
  }, [asset?.id, asset?.price, asset?.prim?.muAnn, asset?.prim?.volAnn])

  if (!asset || !fan) return null

  return (
    <section style={{ ...S.panel, ...S.fadeIn, padding: 16, marginBottom: 16 }}>
      <h2 style={{ ...S.h2, display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
        <TrendingUp size={15} color={T.gold} /> 30-day GBM band — {asset.name || asset.symbol}
      </h2>
      <div style={{ ...S.mono, fontSize: 11, color: T.dim, marginBottom: 10 }}>
        300 paths · μ = {(asset.prim.muAnn ?? 0).toFixed(2)} · σ = {(asset.prim.volAnn ?? 0).toFixed(2)} (annualized, clamped) · spot ${fmtPrice(asset.price)}
      </div>
      <div style={{ width: '100%', height: 260 }}>
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={fan} margin={{ top: 8, right: 12, bottom: 4, left: 4 }}>
            <XAxis
              dataKey="day"
              tick={{ fontFamily: FONTS.mono, fontSize: 10, fill: T.faint }}
              tickLine={false}
              axisLine={{ stroke: T.line }}
              label={{ value: 'days', position: 'insideBottomRight', fontSize: 10, fill: T.faint }}
            />
            <YAxis
              domain={['auto', 'auto']}
              tick={{ fontFamily: FONTS.mono, fontSize: 10, fill: T.faint }}
              tickLine={false}
              axisLine={false}
              width={70}
              tickFormatter={(v) => fmtPrice(v)}
            />
            <Tooltip
              contentStyle={{ background: T.panel2, border: `1px solid ${T.line}`, borderRadius: 6, fontFamily: FONTS.mono, fontSize: 11 }}
              labelStyle={{ color: T.dim }}
              itemStyle={{ color: T.ink }}
              labelFormatter={(d) => `day ${d}`}
              formatter={(v, name) => {
                if (Array.isArray(v)) return [`${fmtPrice(v[0])} – ${fmtPrice(v[1])}`, name === 'outer' ? 'p5–p95' : 'p25–p75']
                return [fmtPrice(v), 'median (p50)']
              }}
            />
            <Area type="monotone" dataKey="outer" stroke="none" fill={T.violet} fillOpacity={0.14} isAnimationActive={false} />
            <Area type="monotone" dataKey="inner" stroke="none" fill={T.violet} fillOpacity={0.26} isAnimationActive={false} />
            <Line type="monotone" dataKey="median" stroke={T.amber} strokeWidth={2} dot={false} isAnimationActive={false} />
            <ReferenceLine y={asset.price} stroke={T.dim} strokeDasharray="5 4" strokeWidth={1} />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
      <div style={{ fontSize: 11, color: T.faint, marginTop: 8, lineHeight: 1.5 }}>
        Geometric Brownian motion band (p5/p25/p50/p75/p95) seeded from recent drift and volatility. A model band, <b style={{ color: T.dim }}>NOT a forecast</b> — real return tails are fatter than the lognormal model assumes. Dashed line = current spot.
      </div>
    </section>
  )
}
