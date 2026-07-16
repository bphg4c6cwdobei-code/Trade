import React from 'react'
import { T, FONTS } from '../theme.js'

// Shared segmented control used by the quadrant selector and data-source panel.
export default function Segmented({ options, value, onChange, size = 'md' }) {
  const pad = size === 'lg' ? '10px 18px' : '6px 12px'
  const fontSize = size === 'lg' ? 13 : 11
  return (
    <div
      style={{
        display: 'inline-flex',
        background: T.panel2,
        border: `1px solid ${T.line}`,
        borderRadius: 8,
        padding: 3,
        gap: 3,
      }}
    >
      {options.map((o) => {
        const active = o.value === value
        return (
          <button
            key={o.value}
            onClick={() => onChange(o.value)}
            title={o.title || ''}
            style={{
              padding: pad,
              fontSize,
              fontFamily: FONTS.mono,
              letterSpacing: '0.04em',
              color: active ? T.ink : T.dim,
              background: active ? T.panel : 'transparent',
              border: active ? `1px solid ${T.line}` : '1px solid transparent',
              borderRadius: 6,
              cursor: 'pointer',
              transition: 'background 160ms ease, color 160ms ease',
              boxShadow: active ? `inset 0 0 0 1px ${T.crimsonDeep}` : 'none',
            }}
          >
            {o.label}
          </button>
        )
      })}
    </div>
  )
}
