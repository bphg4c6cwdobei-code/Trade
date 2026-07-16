import React from 'react'
import { Table2 } from 'lucide-react'
import { T, FONTS, S, fmtPrice, fmtPct, fmtNum, pctColor } from '../theme.js'

const th = {
  fontFamily: FONTS.mono,
  fontSize: 10,
  letterSpacing: '0.1em',
  textTransform: 'uppercase',
  color: T.faint,
  textAlign: 'right',
  padding: '8px 10px',
  borderBottom: `1px solid ${T.line}`,
  whiteSpace: 'nowrap',
}
const td = {
  fontFamily: FONTS.mono,
  fontVariantNumeric: 'tabular-nums',
  fontSize: 12,
  color: T.ink,
  textAlign: 'right',
  padding: '7px 10px',
  borderBottom: `1px solid ${T.line}`,
  whiteSpace: 'nowrap',
}
const left = { textAlign: 'left' }

export default function UniverseTable({ ranked, isSnapshot, selectedId, onSelect, momKey, recentLabel }) {
  if (ranked.length === 0) return null
  return (
    <section style={{ ...S.panel, ...S.fadeIn, padding: 16, marginBottom: 16 }}>
      <h2 style={{ ...S.h2, display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
        <Table2 size={15} color={T.gold} /> Full universe ({ranked.length})
        {isSnapshot && <span style={{ ...S.label, color: T.amber }}>· indicative snapshot</span>}
      </h2>
      <div style={{ overflowX: 'auto' }}>
        <table style={{ borderCollapse: 'collapse', width: '100%' }}>
          <thead>
            <tr>
              <th style={{ ...th, ...left }}>#</th>
              <th style={{ ...th, ...left }}>asset</th>
              <th style={th}>price</th>
              <th style={th}>{recentLabel}</th>
              <th style={th}>vol ann</th>
              <th style={th}>{momKey === 'momS' ? 'mom-s' : 'mom-l'}</th>
              <th style={th}>trend</th>
              <th style={th}>max dd</th>
              <th style={th}>liq (ln)</th>
              <th style={th}>β</th>
              {isSnapshot && <th style={th}>as-of</th>}
              <th style={th}>Z</th>
            </tr>
          </thead>
          <tbody>
            {ranked.map((a) => {
              const isTop5 = a.rank <= 5
              const selected = a.id === selectedId
              return (
                <tr
                  key={a.id}
                  onClick={() => onSelect(a.id)}
                  style={{
                    cursor: 'pointer',
                    background: selected ? `${T.gold}14` : isTop5 ? `${T.crimsonDeep}22` : 'transparent',
                    transition: 'background 160ms ease',
                  }}
                >
                  <td style={{ ...td, ...left, color: isTop5 ? T.gold : T.faint }}>{a.rank}</td>
                  <td style={{ ...td, ...left }}>
                    <span style={{ color: T.ink }}>{a.symbol}</span>
                    {a.name && <span style={{ color: T.faint, fontSize: 11 }}> · {a.name}</span>}
                  </td>
                  <td style={td}>${fmtPrice(a.price)}</td>
                  <td style={{ ...td, color: pctColor(a.recentPct) }}>{fmtPct(a.recentPct)}</td>
                  <td style={td}>{a.prim.volAnn != null ? `${(a.prim.volAnn * 100).toFixed(0)}%` : '—'}</td>
                  <td style={{ ...td, color: pctColor(a.prim[momKey]) }}>{fmtPct(a.prim[momKey])}</td>
                  <td style={td}>{fmtNum(a.prim.trend, 2)}</td>
                  <td style={{ ...td, color: a.prim.res != null ? T.red : T.faint }}>
                    {a.prim.res != null ? `${(a.prim.res * 100).toFixed(1)}%` : '—'}
                  </td>
                  <td style={td}>{fmtNum(a.prim.liq, 1)}</td>
                  <td style={td}>{fmtNum(a.prim.beta, 2)}</td>
                  {isSnapshot && <td style={{ ...td, color: T.faint, fontSize: 11 }}>{a.asOf || '—'}</td>}
                  <td style={{ ...td, color: a.composite >= 0 ? T.teal : T.crimson, fontWeight: 600 }}>{fmtNum(a.composite, 2)}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      <div style={{ fontSize: 10, color: T.faint, marginTop: 8 }}>
        Click a row to select it for the projection. "—" = missing datum, ranked neutrally (z = 0).
      </div>
    </section>
  )
}
