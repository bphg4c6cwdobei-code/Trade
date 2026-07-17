import React, { useState } from 'react'
import { Radar, ShieldAlert } from 'lucide-react'
import { T, FONTS, S, fmtNum } from '../theme.js'
import { SUS_META } from '../lib/sus.js'

const levelColor = { high: T.red, elevated: T.amber, normal: T.faint }

function SignalChip({ k, z }) {
  const m = SUS_META[k]
  const hot = z >= 1.5
  const warm = z >= 0.75
  return (
    <span
      title={`${m.name}: z = ${fmtNum(z, 2)} — ${m.desc}`}
      style={{
        fontFamily: FONTS.mono, fontSize: 9, letterSpacing: '0.06em',
        padding: '2px 6px', borderRadius: 4,
        color: hot ? T.red : warm ? T.amber : T.faint,
        border: `1px solid ${hot ? T.red : warm ? T.amber : T.line}${hot || warm ? '77' : ''}`,
        background: hot ? `${T.red}14` : warm ? `${T.amber}0d` : 'transparent',
      }}
    >
      {m.code} {z >= 0 ? '+' : ''}{z.toFixed(1)}
    </span>
  )
}

export default function SusPanel({
  susRanked, assetClass, overlayStatus,
  polFeedUrl, onPolFeedUrl, onLoadPolFeed, polTrades,
}) {
  const [showAll, setShowAll] = useState(false)
  if (!susRanked || susRanked.length === 0) return null
  const shown = showAll ? susRanked : susRanked.slice(0, 6)
  const flagged = susRanked.filter((a) => a.sus.level !== 'normal').length

  return (
    <section style={{ ...S.panel, ...S.fadeIn, padding: 16, marginBottom: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
        <h2 style={{ ...S.h2, display: 'flex', alignItems: 'center', gap: 8 }}>
          <Radar size={15} color={T.gold} /> Suspicion radar
          <span style={{ ...S.label, fontWeight: 400 }}>· {flagged} flagged of {susRanked.length}</span>
        </h2>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {overlayStatus.map((o) => (
            <span key={o.key} title={o.detail} style={{ ...S.mono, fontSize: 10, padding: '3px 8px', borderRadius: 4, border: `1px solid ${T.line}`, color: o.ok ? T.teal : T.faint }}>
              {o.ok ? '●' : '○'} {o.label}
            </span>
          ))}
        </div>
      </div>

      <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start', fontSize: 12, lineHeight: 1.6, color: T.dim, margin: '10px 0 12px', borderLeft: `2px solid ${T.amber}`, paddingLeft: 10 }}>
        <ShieldAlert size={14} color={T.amber} style={{ flexShrink: 0, marginTop: 3 }} />
        <span>
          <b style={{ color: T.amber }}>Unusual ≠ illegal.</b> These flags measure statistical unusualness on public
          data relative to this universe — heavy churn, volume without price movement, volatility breaks, insider
          <i> filings</i> (which are legal and routine), disclosed lawmaker trades. Nothing here is evidence of
          wrongdoing by anyone, and a quiet asset is not certified clean.
        </span>
      </div>

      <div style={{ display: 'grid', gap: 6 }}>
        {shown.map((a) => (
          <div key={a.symbol} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '7px 10px', background: a.sus.level !== 'normal' ? `${levelColor[a.sus.level]}0a` : T.panel2, border: `1px solid ${a.sus.level !== 'normal' ? levelColor[a.sus.level] + '44' : T.line}`, borderRadius: 8, flexWrap: 'wrap' }}>
            <span style={{ ...S.mono, fontSize: 12, color: T.ink, width: 56 }}>{a.symbol}</span>
            <span style={{ ...S.mono, fontSize: 10, color: levelColor[a.sus.level], width: 64, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
              {a.sus.level}
            </span>
            <div style={{ flex: 1, minWidth: 90, height: 5, background: T.bg, borderRadius: 3, overflow: 'hidden' }}>
              <div
                style={{
                  width: `${Math.min(Math.max(a.sus.score, 0) / 2.5, 1) * 100}%`, height: '100%',
                  background: levelColor[a.sus.level] === T.faint ? T.line : levelColor[a.sus.level],
                  transition: 'width 400ms ease',
                }}
              />
            </div>
            <span style={{ ...S.mono, fontSize: 11, color: T.dim, width: 44, textAlign: 'right' }}>{fmtNum(a.sus.score, 2)}</span>
            <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
              {Object.entries(a.sus.signals).map(([k, z]) => <SignalChip key={k} k={k} z={z} />)}
            </div>
          </div>
        ))}
      </div>
      {susRanked.length > 6 && (
        <button
          onClick={() => setShowAll((v) => !v)}
          style={{ marginTop: 8, padding: '5px 10px', background: 'transparent', color: T.dim, border: `1px solid ${T.line}`, borderRadius: 6, fontFamily: FONTS.mono, fontSize: 10, cursor: 'pointer' }}
        >
          {showAll ? 'show top 6' : `show all ${susRanked.length}`}
        </button>
      )}

      {assetClass === 'stocks' && (
        <div style={{ marginTop: 14, borderTop: `1px solid ${T.line}`, paddingTop: 12 }}>
          <div style={{ ...S.label, marginBottom: 5 }}>
            lawmaker trade feed (optional · STOCK Act disclosures · "user/repo" or raw url)
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <input
              value={polFeedUrl}
              onChange={(e) => onPolFeedUrl(e.target.value)}
              placeholder="youruser/congress-feed  — public mirrors died; see the sus-feed kit"
              spellCheck={false}
              style={{ flex: 1, minWidth: 240, background: T.bg, border: `1px solid ${T.line}`, borderRadius: 6, color: T.ink, fontFamily: FONTS.mono, fontSize: 12, padding: '7px 10px' }}
            />
            <button
              onClick={onLoadPolFeed}
              style={{ padding: '7px 14px', background: 'transparent', color: T.dim, border: `1px solid ${T.line}`, borderRadius: 6, fontFamily: FONTS.mono, fontSize: 11, cursor: 'pointer' }}
            >
              load feed
            </button>
          </div>
          {polTrades && polTrades.length > 0 && (
            <div style={{ marginTop: 8 }}>
              {polTrades.slice(0, 6).map((t, i) => (
                <div key={i} style={{ display: 'flex', gap: 10, ...S.mono, fontSize: 10, color: T.dim, padding: '3px 0', borderBottom: `1px solid ${T.line}`, flexWrap: 'wrap' }}>
                  <span style={{ color: T.faint }}>{t.date}</span>
                  <span style={{ color: T.ink, width: 52 }}>{t.ticker}</span>
                  <span style={{ color: t.side === 'buy' ? T.teal : T.crimson, width: 34 }}>{(t.side || '').toUpperCase()}</span>
                  <span>{t.name}</span>
                  <span style={{ color: T.faint }}>{t.chamber}</span>
                  <span style={{ color: T.faint }}>{t.amount}</span>
                </div>
              ))}
              <div style={{ fontSize: 10, color: T.faint, marginTop: 4 }}>
                Public STOCK Act disclosures from your feed. Disclosure is a legal filing, not an accusation.
              </div>
            </div>
          )}
        </div>
      )}
    </section>
  )
}
