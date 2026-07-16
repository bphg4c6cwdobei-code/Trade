import React from 'react'
import { Trophy } from 'lucide-react'
import { T, FONTS, S, fmtPrice, fmtPct, pctColor, fmtNum } from '../theme.js'
import { FACTOR_META } from '../lib/factors.js'

function MiniBar({ code, z }) {
  const w = Math.min(Math.abs(z) / 2.5, 1) * 100
  const color = z >= 0 ? T.teal : T.crimson
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }} title={`${code} z = ${fmtNum(z, 2)}`}>
      <span style={{ ...S.mono, fontSize: 9, color: T.faint, width: 26 }}>{code}</span>
      <div style={{ flex: 1, height: 4, background: T.panel2, borderRadius: 2, overflow: 'hidden' }}>
        <div style={{ width: `${w}%`, height: '100%', background: color, borderRadius: 2, transition: 'width 400ms ease' }} />
      </div>
      <span style={{ ...S.mono, fontSize: 9, color: T.dim, width: 34, textAlign: 'right' }}>{fmtNum(z, 2)}</span>
    </div>
  )
}

export default function Top5({ ranked, selectedId, onSelect, showBeta, recentLabel }) {
  const top = ranked.slice(0, 5)
  if (top.length === 0) return null
  const barKeys = showBeta ? ['mom', 'vol', 'trend', 'res', 'liq', 'beta'] : ['mom', 'vol', 'trend', 'res', 'liq']
  return (
    <section style={{ ...S.fadeIn, marginBottom: 16 }}>
      <h2 style={{ ...S.h2, display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
        <Trophy size={15} color={T.gold} /> Top 5 by composite score
        <span style={{ ...S.label, fontWeight: 400 }}>· recent behavior, not a recommendation</span>
      </h2>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(215px, 1fr))', gap: 10 }}>
        {top.map((a) => {
          const selected = a.id === selectedId
          return (
            <button
              key={a.id}
              onClick={() => onSelect(a.id)}
              style={{
                ...S.panel,
                textAlign: 'left',
                padding: 14,
                cursor: 'pointer',
                border: `1px solid ${selected ? T.gold : T.line}`,
                boxShadow: selected ? `0 0 0 1px ${T.gold}55` : 'none',
                transition: 'transform 160ms ease, border-color 160ms ease',
                color: T.ink,
              }}
              onMouseEnter={(e) => (e.currentTarget.style.transform = 'translateY(-2px)')}
              onMouseLeave={(e) => (e.currentTarget.style.transform = 'none')}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
                <span style={{ fontFamily: FONTS.display, fontWeight: 800, fontSize: 26, color: a.rank === 1 ? T.gold : T.faint, width: 22 }}>
                  {a.rank}
                </span>
                {a.image ? (
                  <img src={a.image} alt="" width={26} height={26} style={{ borderRadius: '50%' }} />
                ) : (
                  <span
                    style={{
                      width: 26, height: 26, borderRadius: '50%', background: T.panel2, border: `1px solid ${T.line}`,
                      display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                      fontFamily: FONTS.mono, fontSize: 10, color: T.gold,
                    }}
                  >
                    {a.symbol.slice(0, 2)}
                  </span>
                )}
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontFamily: FONTS.sans, fontWeight: 600, fontSize: 13, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {a.name || a.symbol}
                  </div>
                  <div style={{ ...S.mono, fontSize: 10, color: T.faint }}>{a.symbol}</div>
                </div>
              </div>
              <div style={{ display: 'grid', gap: 4, marginBottom: 10 }}>
                {barKeys.map((k) => (
                  <MiniBar key={k} code={FACTOR_META[k].code} z={a.z[k]} />
                ))}
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                <span style={{ ...S.mono, fontSize: 14, color: T.ink }}>${fmtPrice(a.price)}</span>
                <span style={{ ...S.mono, fontSize: 11, color: pctColor(a.recentPct) }} title={recentLabel}>
                  {fmtPct(a.recentPct)}
                </span>
                <span style={{ ...S.mono, fontSize: 11, color: T.gold }}>Z {fmtNum(a.composite, 2)}</span>
              </div>
            </button>
          )
        })}
      </div>
    </section>
  )
}
