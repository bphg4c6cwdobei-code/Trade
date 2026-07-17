import React, { useEffect, useRef, useState } from 'react'
import { Waves } from 'lucide-react'
import { T, FONTS, S, fmtPrice } from '../theme.js'
import { loadWhaleTxs, WHALE_MIN_BTC } from '../lib/susLoaders.js'

const POLL_MS = 30_000
const KEEP = 14

// Live large-BTC-transaction ticker (crypto view). Accumulates whales seen
// across polls. Hides itself with a one-line note if every source fails.
export default function WhaleTicker({ btcUsd }) {
  const [whales, setWhales] = useState([])
  const [meta, setMeta] = useState({ source: null, sampled: 0, polls: 0, failed: false })
  const seen = useRef(new Set())

  useEffect(() => {
    const ctrl = new AbortController()
    let timer = null
    const poll = async () => {
      try {
        const res = await loadWhaleTxs({ signal: ctrl.signal })
        setMeta((m) => ({ source: res.source, sampled: m.sampled + res.sampled, polls: m.polls + 1, failed: false }))
        const fresh = res.whales.filter((w) => !seen.current.has(w.txid))
        fresh.forEach((w) => seen.current.add(w.txid))
        if (fresh.length) {
          const stamped = fresh.map((w) => ({ ...w, seenAt: Date.now() }))
          setWhales((prev) => [...stamped, ...prev].slice(0, KEEP))
        }
      } catch (e) {
        if (e?.name === 'AbortError') return
        setMeta((m) => ({ ...m, polls: m.polls + 1, failed: m.source == null }))
      }
      timer = setTimeout(poll, POLL_MS)
    }
    poll()
    return () => {
      ctrl.abort()
      if (timer) clearTimeout(timer)
    }
  }, [])

  // every source failed and we never got data: vanish quietly but honestly
  if (meta.failed && meta.polls > 0) return null

  return (
    <section style={{ ...S.panel, ...S.fadeIn, padding: 16, marginBottom: 16 }}>
      <h2 style={{ ...S.h2, display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
        <Waves size={15} color={T.teal} /> On-chain whale flow — BTC
        <span style={{ ...S.label, fontWeight: 400 }}>· transfers ≥ {WHALE_MIN_BTC} BTC entering the mempool</span>
      </h2>
      <div style={{ ...S.mono, fontSize: 10, color: T.faint, marginBottom: 10 }}>
        {meta.source ? `source: ${meta.source} · ${meta.sampled} txs sampled · polls every ${POLL_MS / 1000}s` : 'connecting…'}
      </div>
      {whales.length === 0 && (
        <div style={{ ...S.mono, fontSize: 11, color: T.faint }}>
          no transfers ≥ {WHALE_MIN_BTC} BTC seen yet — the sample is the newest mempool slice, whales take a few polls to appear
        </div>
      )}
      {whales.map((w) => (
        <div key={w.txid} style={{ display: 'flex', gap: 12, alignItems: 'baseline', ...S.mono, fontSize: 11, padding: '4px 0', borderBottom: `1px solid ${T.line}`, flexWrap: 'wrap' }}>
          <span style={{ color: T.faint, fontSize: 10 }}>
            {new Date(w.time || w.seenAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </span>
          <span style={{ color: w.btc >= 50 ? T.red : w.btc >= 20 ? T.amber : T.teal, fontWeight: 600 }}>
            {w.btc.toFixed(2)} BTC
          </span>
          {btcUsd > 0 && <span style={{ color: T.dim }}>≈ ${fmtPrice(w.btc * btcUsd)}</span>}
          <span style={{ color: T.faint, fontSize: 10, overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 220 }}>{w.txid}</span>
        </div>
      ))}
      <div style={{ fontSize: 10, color: T.faint, marginTop: 8, lineHeight: 1.5 }}>
        Large transfers are routine (exchange sweeps, custody rebalancing). This shows flow; it identifies no one and
        implies nothing illicit.
      </div>
    </section>
  )
}
