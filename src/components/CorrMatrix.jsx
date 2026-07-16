import React, { useMemo, useState } from 'react'
import { Grid3x3 } from 'lucide-react'
import { T, FONTS, S } from '../theme.js'
import { pearson } from '../lib/math.js'

// Diverging fill: crimson for positive correlation, teal for negative.
function cellColor(r) {
  const a = Math.min(Math.abs(r), 1)
  if (r >= 0) return `rgba(226, 59, 50, ${0.08 + a * 0.72})`
  return `rgba(63, 182, 168, ${0.08 + a * 0.72})`
}

export default function CorrMatrix({ assets }) {
  const [hover, setHover] = useState(null)
  const withSeries = useMemo(() => assets.filter((a) => a.prim.returns && a.prim.returns.length >= 10), [assets])
  const matrix = useMemo(() => {
    return withSeries.map((a) => withSeries.map((b) => (a.id === b.id ? 1 : pearson(a.prim.returns, b.prim.returns))))
  }, [withSeries])

  if (withSeries.length < 2) return null
  const showValues = withSeries.length <= 14
  const cell = Math.max(26, Math.min(44, Math.floor(640 / withSeries.length)))

  return (
    <section style={{ ...S.panel, ...S.fadeIn, padding: 16, marginBottom: 16 }}>
      <h2 style={{ ...S.h2, display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
        <Grid3x3 size={15} color={T.gold} /> Return correlation
      </h2>
      <div style={{ ...S.mono, fontSize: 11, color: T.dim, marginBottom: 12 }}>
        Pearson on aligned recent returns · <span style={{ color: T.crimson }}>■ positive</span> · <span style={{ color: T.teal }}>■ negative</span>
        {hover && <span style={{ color: T.ink }}> · {hover}</span>}
      </div>
      <div style={{ overflowX: 'auto', paddingBottom: 4 }}>
        <table style={{ borderCollapse: 'separate', borderSpacing: 2 }}>
          <thead>
            <tr>
              <th />
              {withSeries.map((a) => (
                <th key={a.id} style={{ fontFamily: FONTS.mono, fontSize: 9, color: T.faint, fontWeight: 400, padding: 2, maxWidth: cell, overflow: 'hidden' }}>
                  {a.symbol}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {withSeries.map((a, i) => (
              <tr key={a.id}>
                <td style={{ fontFamily: FONTS.mono, fontSize: 9, color: T.faint, padding: '0 6px 0 0', textAlign: 'right' }}>{a.symbol}</td>
                {withSeries.map((b, j) => {
                  const r = matrix[i][j]
                  return (
                    <td
                      key={b.id}
                      onMouseEnter={() => setHover(`${a.symbol} × ${b.symbol}: ${r.toFixed(2)}`)}
                      onMouseLeave={() => setHover(null)}
                      style={{
                        width: cell,
                        height: cell,
                        minWidth: cell,
                        background: cellColor(r),
                        borderRadius: 4,
                        textAlign: 'center',
                        fontFamily: FONTS.mono,
                        fontSize: 9,
                        color: Math.abs(r) > 0.55 ? T.ink : T.dim,
                        cursor: 'default',
                      }}
                    >
                      {showValues ? r.toFixed(2) : ''}
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  )
}
