// Design tokens — single source of truth for the terminal's look.
export const T = {
  bg: '#0b0a09',
  panel: '#131110',
  panel2: '#1b1816',
  line: '#2a2622',
  ink: '#efe9e1',
  dim: '#9a8f82',
  faint: '#6b6157',
  crimson: '#e23b32',
  crimsonDeep: '#7c1a14',
  amber: '#e8a33d',
  teal: '#3fb6a8',
  violet: '#9b7bd1',
  green: '#5fbf6b',
  red: '#e2554b',
  gold: '#caa24a',
}

export const FONTS = {
  display: "'Spectral', Georgia, serif",
  mono: "'IBM Plex Mono', ui-monospace, Menlo, monospace",
  sans: "'IBM Plex Sans', system-ui, sans-serif",
}

// Shared style fragments
export const S = {
  panel: {
    background: T.panel,
    border: `1px solid ${T.line}`,
    borderRadius: 10,
  },
  mono: {
    fontFamily: FONTS.mono,
    fontVariantNumeric: 'tabular-nums',
  },
  label: {
    fontFamily: FONTS.mono,
    fontSize: 10,
    letterSpacing: '0.12em',
    textTransform: 'uppercase',
    color: T.faint,
  },
  h2: {
    fontFamily: FONTS.display,
    fontWeight: 700,
    fontSize: 18,
    color: T.ink,
    margin: 0,
  },
  fadeIn: {
    animation: 'qt-fadein 320ms ease both',
  },
}

// Price formatting: ≥1000 no decimals; ≥1 two decimals; ≥0.01 four; else 3 sig figs.
export function fmtPrice(v) {
  if (v == null || !Number.isFinite(v)) return '—'
  if (v >= 1000) return v.toLocaleString('en-US', { maximumFractionDigits: 0 })
  if (v >= 1) return v.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  if (v >= 0.01) return v.toFixed(4)
  return v.toPrecision(3)
}

export function fmtPct(v, digits = 2) {
  if (v == null || !Number.isFinite(v)) return '—'
  const s = v >= 0 ? '+' : ''
  return `${s}${v.toFixed(digits)}%`
}

export function fmtNum(v, digits = 2) {
  if (v == null || !Number.isFinite(v)) return '—'
  return v.toFixed(digits)
}

export function pctColor(v) {
  if (v == null || !Number.isFinite(v)) return T.faint
  return v >= 0 ? T.green : T.red
}
