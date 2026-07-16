import React, { useState } from 'react'
import { Database, Trash2 } from 'lucide-react'
import { T, FONTS, S } from '../theme.js'
import Segmented from './Segmented.jsx'

const inputStyle = {
  background: T.bg,
  border: `1px solid ${T.line}`,
  borderRadius: 6,
  color: T.ink,
  fontFamily: FONTS.mono,
  fontSize: 12,
  padding: '8px 10px',
  width: '100%',
}

const MODE_HELP = {
  relay:
    'Keyless: Yahoo (unofficial) via public CORS relays, Stooq as per-symbol fallback. Relays are third parties — they see the ticker URLs you request (nothing else). Personal use only, not a product backend.',
  gh: 'Most durable, zero proxy: a public GitHub repo serves prices.json over raw.githubusercontent.com, which sends CORS headers. Point at "user/repo" or a full raw URL. The bundled gh-feed kit (yfinance + GitHub Action) produces the feed.',
  key: 'TwelveData with your own API key (free tier ≈ 8 req/min, 800/day). The key is stored locally in your browser only.',
  snap: 'Static indicative snapshot — never fails, never fresh. Six large tickers with early-June-2026 figures; missing fields show as "—" and rank neutrally.',
}

export default function DataSourcePanel({
  mode, onMode,
  symbols, onSymbols,
  customProxy, onCustomProxy,
  ghUrl, onGhUrl,
  apiKey, onApiKey,
  status, progress, summary, error, log,
  onLoad, onClearSettings,
}) {
  const [showLog, setShowLog] = useState(false)
  const busy = status === 'loading'
  return (
    <section style={{ ...S.panel, ...S.fadeIn, padding: 16, marginBottom: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}>
        <h2 style={{ ...S.h2, display: 'flex', alignItems: 'center', gap: 8 }}>
          <Database size={15} color={T.gold} /> Equity data source
        </h2>
        <Segmented
          value={mode}
          onChange={onMode}
          options={[
            { value: 'relay', label: 'KEYLESS RELAYS' },
            { value: 'gh', label: 'GITHUB FEED' },
            { value: 'key', label: 'API KEY' },
            { value: 'snap', label: 'SNAPSHOT' },
          ]}
        />
      </div>
      <p style={{ color: T.dim, fontSize: 12, lineHeight: 1.55, margin: '10px 0 12px' }}>{MODE_HELP[mode]}</p>

      {mode !== 'snap' && mode !== 'gh' && (
        <div style={{ marginBottom: 10 }}>
          <div style={{ ...S.label, marginBottom: 5 }}>symbols (max 10 · SPY auto-added as beta benchmark)</div>
          <input
            style={inputStyle}
            value={symbols}
            onChange={(e) => onSymbols(e.target.value)}
            placeholder="NVDA, QQQ, AAPL, MSFT…"
            spellCheck={false}
          />
        </div>
      )}
      {mode === 'relay' && (
        <div style={{ marginBottom: 10 }}>
          <div style={{ ...S.label, marginBottom: 5 }}>custom relay url (optional — tried before public relays)</div>
          <input
            style={inputStyle}
            value={customProxy}
            onChange={(e) => onCustomProxy(e.target.value)}
            placeholder="https://my-relay.example.com/?url=  (or cors-anywhere style prefix)"
            spellCheck={false}
          />
        </div>
      )}
      {mode === 'gh' && (
        <div style={{ marginBottom: 10 }}>
          <div style={{ ...S.label, marginBottom: 5 }}>github feed — "user/repo" or full raw url to prices.json</div>
          <input
            style={inputStyle}
            value={ghUrl}
            onChange={(e) => onGhUrl(e.target.value)}
            placeholder="youruser/yourrepo"
            spellCheck={false}
          />
          <div style={{ fontSize: 11, color: T.faint, marginTop: 6 }}>
            Feed schema: {'{ "updated": ISO8601, "series": { "SPY": { "closes": […], "volumes": […] } } }'} — see the{' '}
            <a href={`${import.meta.env.BASE_URL}gh-feed/README.md`} target="_blank" rel="noreferrer" style={{ color: T.teal }}>
              bundled gh-feed kit
            </a>{' '}
            for a yfinance script + GitHub Action that publishes it.
          </div>
        </div>
      )}
      {mode === 'key' && (
        <div style={{ marginBottom: 10 }}>
          <div style={{ ...S.label, marginBottom: 5 }}>twelvedata api key (stored locally only)</div>
          <input
            style={inputStyle}
            value={apiKey}
            onChange={(e) => onApiKey(e.target.value)}
            placeholder="your TwelveData API key"
            type="password"
            spellCheck={false}
          />
        </div>
      )}

      <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
        {mode !== 'snap' && (
          <button
            onClick={onLoad}
            disabled={busy}
            style={{
              padding: '9px 20px',
              background: busy ? T.panel2 : T.crimsonDeep,
              color: T.ink,
              border: `1px solid ${busy ? T.line : T.crimson}`,
              borderRadius: 6,
              fontFamily: FONTS.mono,
              fontSize: 12,
              letterSpacing: '0.06em',
              cursor: busy ? 'default' : 'pointer',
            }}
          >
            {busy ? progress || 'LOADING…' : 'LOAD DATA'}
          </button>
        )}
        {summary && <span style={{ ...S.mono, fontSize: 11, color: T.dim }}>{summary}</span>}
        {mode === 'snap' && (
          <span style={{ ...S.mono, fontSize: 11, color: T.amber, border: `1px solid ${T.amber}44`, padding: '4px 10px', borderRadius: 5 }}>
            INDICATIVE — static snapshot, not live data
          </span>
        )}
        <span style={{ flex: 1 }} />
        {log.length > 0 && (
          <button
            onClick={() => setShowLog((v) => !v)}
            style={{ padding: '6px 10px', background: 'transparent', color: T.dim, border: `1px solid ${T.line}`, borderRadius: 6, fontSize: 11, cursor: 'pointer' }}
          >
            relay log ({log.length}) {showLog ? '▾' : '▸'}
          </button>
        )}
        <button
          onClick={onClearSettings}
          title="Clear saved settings (API key, symbols, relay, weights)"
          style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '6px 10px', background: 'transparent', color: T.faint, border: `1px solid ${T.line}`, borderRadius: 6, fontSize: 11, cursor: 'pointer' }}
        >
          <Trash2 size={11} /> clear saved settings
        </button>
      </div>

      {error && (
        <div style={{ marginTop: 10, padding: '8px 12px', border: `1px solid ${T.red}55`, borderRadius: 6, color: T.red, fontSize: 12, fontFamily: FONTS.mono }}>
          {error}
        </div>
      )}
      {showLog && log.length > 0 && (
        <pre
          style={{
            marginTop: 10,
            marginBottom: 0,
            maxHeight: 180,
            overflow: 'auto',
            background: T.bg,
            border: `1px solid ${T.line}`,
            borderRadius: 6,
            padding: 10,
            fontFamily: FONTS.mono,
            fontSize: 11,
            lineHeight: 1.6,
            color: T.dim,
            whiteSpace: 'pre-wrap',
          }}
        >
          {log.join('\n')}
        </pre>
      )}
    </section>
  )
}
