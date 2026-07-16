import React from 'react'
import { RefreshCw } from 'lucide-react'
import { T, FONTS, S } from '../theme.js'

export default function Header({ cryptoStatus, countdown, onRefresh, isCrypto }) {
  const dotColor =
    cryptoStatus === 'ready' ? T.green : cryptoStatus === 'error' ? T.red : cryptoStatus === 'stale' ? T.amber : T.faint
  return (
    <header
      style={{
        display: 'flex',
        alignItems: 'baseline',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: 12,
        padding: '22px 0 14px',
        borderBottom: `1px solid ${T.line}`,
      }}
    >
      <div>
        <h1
          style={{
            fontFamily: FONTS.display,
            fontWeight: 800,
            fontSize: 30,
            color: T.ink,
            margin: 0,
            letterSpacing: '-0.01em',
          }}
        >
          Quant<span style={{ color: T.crimson }}> Terminal</span>
        </h1>
        <div style={{ ...S.label, marginTop: 4 }}>multi-factor statistical ranker · four quadrants, one engine</div>
      </div>
      {isCrypto && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span
            style={{
              width: 8,
              height: 8,
              borderRadius: '50%',
              background: dotColor,
              display: 'inline-block',
              animation: cryptoStatus === 'loading' ? 'qt-pulse 1.2s ease infinite' : 'none',
            }}
          />
          <span style={{ ...S.mono, fontSize: 11, color: T.dim }}>
            {cryptoStatus === 'ready' && 'live'}
            {cryptoStatus === 'stale' && 'stale'}
            {cryptoStatus === 'loading' && 'loading'}
            {cryptoStatus === 'error' && 'error'}
            {cryptoStatus === 'idle' && 'idle'}
          </span>
          <button
            onClick={onRefresh}
            title="Refresh now"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              padding: '6px 12px',
              background: T.panel2,
              color: T.dim,
              border: `1px solid ${T.line}`,
              borderRadius: 6,
              fontFamily: FONTS.mono,
              fontSize: 11,
              cursor: 'pointer',
            }}
          >
            <RefreshCw size={12} />
            {countdown != null ? `${countdown}s` : 'refresh'}
          </button>
        </div>
      )}
    </header>
  )
}
