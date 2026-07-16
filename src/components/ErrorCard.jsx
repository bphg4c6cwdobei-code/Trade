import React from 'react'
import { AlertTriangle } from 'lucide-react'
import { T, FONTS, S } from '../theme.js'

export default function ErrorCard({ title, message, onRetry }) {
  return (
    <section style={{ ...S.panel, ...S.fadeIn, padding: 16, marginBottom: 16, borderColor: `${T.red}66` }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
        <AlertTriangle size={15} color={T.red} />
        <span style={{ fontFamily: FONTS.display, fontWeight: 700, fontSize: 15, color: T.red }}>{title}</span>
      </div>
      <div style={{ fontFamily: FONTS.mono, fontSize: 12, color: T.dim, lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>{message}</div>
      {onRetry && (
        <button
          onClick={onRetry}
          style={{ marginTop: 10, padding: '7px 16px', background: 'transparent', color: T.ink, border: `1px solid ${T.line}`, borderRadius: 6, fontFamily: FONTS.mono, fontSize: 11, cursor: 'pointer' }}
        >
          retry
        </button>
      )}
    </section>
  )
}
