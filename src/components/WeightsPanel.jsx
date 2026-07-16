import React from 'react'
import { SlidersHorizontal, RotateCcw } from 'lucide-react'
import { T, FONTS, S } from '../theme.js'
import { FACTOR_KEYS, FACTOR_META } from '../lib/factors.js'

export default function WeightsPanel({ weights, onChange, onReset, volSign, momKey }) {
  return (
    <section style={{ ...S.panel, ...S.fadeIn, padding: 16, marginBottom: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12, flexWrap: 'wrap', gap: 8 }}>
        <h2 style={{ ...S.h2, display: 'flex', alignItems: 'center', gap: 8 }}>
          <SlidersHorizontal size={15} color={T.gold} /> Factor weights
        </h2>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ ...S.mono, fontSize: 11, color: T.dim }}>
            vol {volSign > 0 ? 'rewarded (+)' : 'penalized (−)'} · momentum: {momKey === 'momS' ? 'short blend' : 'long blend'}
          </span>
          <button
            onClick={onReset}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '6px 10px', background: 'transparent', color: T.dim, border: `1px solid ${T.line}`, borderRadius: 6, fontSize: 11, fontFamily: FONTS.mono, cursor: 'pointer' }}
          >
            <RotateCcw size={11} /> reset preset
          </button>
        </div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: '12px 20px' }}>
        {FACTOR_KEYS.map((k) => {
          const m = FACTOR_META[k]
          const v = weights[k] || 0
          return (
            <div key={k} title={m.desc}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                <span style={{ ...S.mono, fontSize: 11, color: T.dim }}>
                  <span style={{ color: T.gold }}>{m.code}</span> {m.name}
                </span>
                <span style={{ ...S.mono, fontSize: 11, color: T.ink }}>{v}</span>
              </div>
              <input
                type="range"
                min={0}
                max={50}
                value={v}
                onChange={(e) => onChange(k, Number(e.target.value))}
                style={{ width: '100%', accentColor: T.crimson, cursor: 'pointer' }}
              />
            </div>
          )
        })}
      </div>
    </section>
  )
}
