import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { AlertTriangle } from 'lucide-react'
import { T, FONTS, S } from './theme.js'
import { logRet } from './lib/math.js'
import {
  loadCrypto, loadEquitiesRelay, loadGhFeed, loadTwelveData,
  parseSymbols, STOCK_SNAPSHOT,
} from './lib/loaders.js'
import {
  PRESETS, quadKey, rankAssets,
  cryptoPrimitives, equityPrimitives, stockSnapPrimitives,
} from './lib/factors.js'
import { loadSettings, saveSetting, clearSettings } from './lib/storage.js'
import { createBot, rebalance, recordTick, needsRebalance, MIN_AUTO_REBALANCE_MS } from './lib/paperbot.js'
import { cryptoSusRaw, equitySusRaw, computeSusScores } from './lib/sus.js'
import { loadInsiderCounts, loadPoliticianFeed } from './lib/susLoaders.js'

import Header from './components/Header.jsx'
import QuadrantSelector from './components/QuadrantSelector.jsx'
import DataSourcePanel from './components/DataSourcePanel.jsx'
import VixCard from './components/VixCard.jsx'
import WeightsPanel from './components/WeightsPanel.jsx'
import Top5 from './components/Top5.jsx'
import ProjectionChart from './components/ProjectionChart.jsx'
import UniverseTable from './components/UniverseTable.jsx'
import CorrMatrix from './components/CorrMatrix.jsx'
import Methodology from './components/Methodology.jsx'
import ErrorCard from './components/ErrorCard.jsx'
import PaperBot from './components/PaperBot.jsx'
import SusPanel from './components/SusPanel.jsx'
import WhaleTicker from './components/WhaleTicker.jsx'

const REFRESH_SECONDS = 60
const saved = loadSettings()

export default function App() {
  // ---- quadrant -----------------------------------------------------------
  const [assetClass, setAssetClass] = useState('crypto')
  const [horizon, setHorizon] = useState('day')
  const qk = quadKey(assetClass, horizon)
  const preset = PRESETS[qk]

  // ---- weights (per-quadrant overrides, persisted) ------------------------
  const [weightOverrides, setWeightOverrides] = useState(saved.weights || {})
  const weights = weightOverrides[qk] || preset.weights
  const setWeight = (k, v) => {
    setWeightOverrides((prev) => {
      const next = { ...prev, [qk]: { ...(prev[qk] || preset.weights), [k]: v } }
      saveSetting('weights', next)
      return next
    })
  }
  const resetWeights = () => {
    setWeightOverrides((prev) => {
      const next = { ...prev }
      delete next[qk]
      saveSetting('weights', next)
      return next
    })
  }

  // ---- crypto (live, auto-refresh) ----------------------------------------
  const [crypto, setCrypto] = useState({ coins: [], status: 'idle', error: null })
  const [countdown, setCountdown] = useState(REFRESH_SECONDS)
  const cryptoAbortRef = useRef(null)

  const refreshCrypto = useCallback(async () => {
    cryptoAbortRef.current?.abort()
    const ctrl = new AbortController()
    cryptoAbortRef.current = ctrl
    setCrypto((c) => (c.coins.length ? c : { ...c, status: 'loading' }))
    try {
      const coins = await loadCrypto(ctrl.signal)
      setCrypto({ coins, status: 'ready', error: null })
    } catch (e) {
      if (e?.name === 'AbortError') return
      // keep last good snapshot on failure, flag it stale
      setCrypto((c) =>
        c.coins.length
          ? { ...c, status: 'stale', error: e.message }
          : { coins: [], status: 'error', error: e.message },
      )
    }
    setCountdown(REFRESH_SECONDS)
  }, [])

  useEffect(() => {
    refreshCrypto()
    return () => cryptoAbortRef.current?.abort()
  }, [refreshCrypto])

  useEffect(() => {
    if (assetClass !== 'crypto') return undefined
    const t = setInterval(() => {
      setCountdown((c) => {
        if (c <= 1) {
          refreshCrypto()
          return REFRESH_SECONDS
        }
        return c - 1
      })
    }, 1000)
    return () => clearInterval(t)
  }, [assetClass, refreshCrypto])

  // ---- equities ------------------------------------------------------------
  const [stockMode, setStockModeRaw] = useState(saved.stockMode || 'relay')
  const [symbolsText, setSymbolsText] = useState(saved.symbols || 'NVDA, QQQ, AAPL, MSFT, GOOGL, AMZN, TSLA, META')
  const [customProxy, setCustomProxy] = useState(saved.customProxy || '')
  const [ghUrl, setGhUrl] = useState(saved.ghUrl || '')
  const [apiKey, setApiKey] = useState(saved.apiKey || '')
  const [equity, setEquity] = useState({ status: 'idle', rows: [], error: null, summary: '', updated: null })
  const [progress, setProgress] = useState('')
  const [relayLog, setRelayLog] = useState([])
  const equityAbortRef = useRef(null)

  const abortEquity = () => {
    equityAbortRef.current?.abort()
    equityAbortRef.current = null
  }

  // Switching modes resets equity state: idle, cleared, in-flight aborted.
  const setStockMode = (m) => {
    abortEquity()
    setStockModeRaw(m)
    saveSetting('stockMode', m)
    setEquity({ status: 'idle', rows: [], error: null, summary: '', updated: null })
    setRelayLog([])
    setProgress('')
  }

  // Tab switch away from stocks also cancels in-flight equity fetches.
  const switchAssetClass = (ac) => {
    if (ac !== 'stocks') abortEquity()
    setAssetClass(ac)
  }

  const loadEquities = async () => {
    abortEquity()
    const ctrl = new AbortController()
    equityAbortRef.current = ctrl
    setEquity({ status: 'loading', rows: [], error: null, summary: '', updated: null })
    setRelayLog([])
    setProgress('')
    const onLog = (line) => setRelayLog((l) => [...l, line])
    try {
      let result
      if (stockMode === 'relay') {
        const syms = parseSymbols(symbolsText)
        result = await loadEquitiesRelay(syms, { customProxy, signal: ctrl.signal, onLog, onProgress: setProgress })
      } else if (stockMode === 'gh') {
        const feed = await loadGhFeed(ghUrl, { signal: ctrl.signal, onLog })
        result = { rows: feed.rows, summary: `${feed.rows.length} symbols from feed${feed.updated ? ' · updated ' + feed.updated : ''}`, updated: feed.updated }
      } else if (stockMode === 'key') {
        if (!apiKey.trim()) throw new Error('Enter a TwelveData API key first.')
        const syms = parseSymbols(symbolsText)
        result = await loadTwelveData(syms, apiKey.trim(), { signal: ctrl.signal, onLog, onProgress: setProgress })
      }
      if (!result || result.rows.length === 0) {
        throw new Error('No symbols loaded — every transport failed. Open the relay log for details; try the GitHub feed or Snapshot mode.')
      }
      setEquity({ status: 'ready', rows: result.rows, error: null, summary: result.summary || '', updated: result.updated || null })
    } catch (e) {
      if (e?.name === 'AbortError') return
      setEquity({ status: 'error', rows: [], error: e.message, summary: '', updated: null })
    } finally {
      setProgress('')
    }
  }

  const persist = (key, setter) => (v) => {
    setter(v)
    saveSetting(key, v)
  }

  const handleClearSettings = () => {
    clearSettings()
    setBots({})
    setWeightOverrides({})
    setApiKey('')
    setCustomProxy('')
    setGhUrl('')
    setSymbolsText('NVDA, QQQ, AAPL, MSFT, GOOGL, AMZN, TSLA, META')
    setStockModeRaw('relay')
    setPolFeedUrl('')
    setPolFeed({ status: 'idle', bySymbol: null, recent: [] })
  }

  // ---- build the current universe -----------------------------------------
  const isSnapshot = assetClass === 'stocks' && stockMode === 'snap'

  const assets = useMemo(() => {
    if (assetClass === 'crypto') {
      const btc = crypto.coins.find((c) => String(c.symbol).toLowerCase() === 'btc')
      const btcReturns = btc ? logRet((btc.sparkline_in_7d?.price || []).filter((v) => Number.isFinite(v) && v > 0)) : null
      return crypto.coins.map((c) => ({
        id: c.id,
        symbol: String(c.symbol || '').toUpperCase(),
        name: c.name,
        image: c.image,
        price: c.current_price,
        recentPct: Number.isFinite(c.price_change_percentage_24h_in_currency) ? c.price_change_percentage_24h_in_currency : null,
        prim: cryptoPrimitives(c, btcReturns),
        susRaw: cryptoSusRaw(c),
      }))
    }
    if (isSnapshot) {
      return STOCK_SNAPSHOT.map((r) => ({
        id: `snap-${r.symbol}`,
        symbol: r.symbol,
        name: r.name,
        image: null,
        price: r.price,
        recentPct: Number.isFinite(r.r1w) ? r.r1w : null,
        asOf: r.asOf,
        prim: stockSnapPrimitives(r),
      }))
    }
    if (equity.status !== 'ready') return []
    const spy = equity.rows.find((r) => r.symbol === 'SPY')
    const spyReturns = spy ? logRet(spy.closes) : null
    return equity.rows.map((r) => {
      const prim = equityPrimitives(r, spyReturns)
      return {
        id: `eq-${r.symbol}`,
        symbol: r.symbol,
        name: r.name || '',
        image: null,
        price: r.closes[r.closes.length - 1],
        recentPct: prim.r1w,
        prim,
        susRaw: equitySusRaw(r),
      }
    })
  }, [assetClass, crypto.coins, isSnapshot, equity.status, equity.rows])

  const ranked = useMemo(
    () => rankAssets(assets, weights, { volSign: preset.volSign, momKey: preset.momKey }),
    [assets, weights, preset.volSign, preset.momKey],
  )

  // ---- suspicion radar overlays ---------------------------------------------
  const [insider, setInsider] = useState({ status: 'idle', bySymbol: null })
  const [polFeedUrl, setPolFeedUrl] = useState(saved.polFeedUrl || '')
  const [polFeed, setPolFeed] = useState({ status: 'idle', bySymbol: null, recent: [] })
  const susLog = useCallback((line) => setRelayLog((l) => [...l, line]), [])

  // Insider filing intensity (SEC EDGAR Form 4 counts) once equities load.
  useEffect(() => {
    if (assetClass !== 'stocks' || isSnapshot || equity.status !== 'ready') return undefined
    const ctrl = new AbortController()
    setInsider({ status: 'loading', bySymbol: null })
    loadInsiderCounts(equity.rows.map((r) => r.symbol), { signal: ctrl.signal, onLog: susLog })
      .then((res) => {
        if (ctrl.signal.aborted) return
        const ok = Object.keys(res.bySymbol).length > 0
        setInsider({ status: ok ? 'ready' : 'error', bySymbol: ok ? res.bySymbol : null })
        if (!ok) susLog('EDGAR Form 4: every symbol failed — insider signal excluded from scores')
      })
      .catch((e) => {
        if (e?.name !== 'AbortError') setInsider({ status: 'error', bySymbol: null })
      })
    return () => ctrl.abort()
  }, [assetClass, isSnapshot, equity.status, equity.rows, susLog])

  const loadPolFeedNow = async () => {
    setPolFeed({ status: 'loading', bySymbol: null, recent: [] })
    try {
      const feed = await loadPoliticianFeed(polFeedUrl, { onLog: susLog })
      setPolFeed({ status: 'ready', bySymbol: feed.bySymbol, recent: feed.recent })
    } catch (e) {
      if (e?.name !== 'AbortError') setPolFeed({ status: 'error', bySymbol: null, recent: [] })
    }
  }

  const susMap = useMemo(() => {
    if (isSnapshot) return {}
    const withRaw = assets.filter((a) => a.susRaw)
    const overlays = {}
    if (assetClass === 'stocks') {
      if (insider.bySymbol) overlays.insider = insider.bySymbol
      if (polFeed.bySymbol) overlays.politician = polFeed.bySymbol
    }
    return computeSusScores(withRaw, assetClass, overlays)
  }, [assets, assetClass, isSnapshot, insider.bySymbol, polFeed.bySymbol])

  // ---- paper trading bot (simulated money, one per quadrant) ----------------
  const [bots, setBots] = useState(saved.paperbot || {})
  const bot = bots[qk] || null
  const priceMap = useMemo(() => {
    const m = {}
    for (const a of ranked) if (Number.isFinite(a.price) && a.price > 0) m[a.symbol] = a.price
    return m
  }, [ranked])
  const topSymbols = useMemo(() => ranked.slice(0, 5).map((a) => a.symbol), [ranked])

  const updateBot = useCallback((key, next) => {
    setBots((prev) => {
      const all = { ...prev }
      if (next == null) delete all[key]
      else all[key] = next
      saveSetting('paperbot', all)
      return all
    })
  }, [])

  const startBot = () => {
    if (ranked.length === 0) return
    const now = Date.now()
    const benchSym = assetClass === 'crypto' ? 'BTC' : 'SPY'
    let b = createBot(now, benchSym, priceMap[benchSym])
    b = rebalance(b, topSymbols, priceMap, now)
    updateBot(qk, recordTick(b, priceMap, now))
  }
  const toggleBot = () => bot && updateBot(qk, { ...structuredClone(bot), running: !bot.running })
  const resetBot = () => updateBot(qk, null)
  const rebalanceBotNow = () => {
    if (!bot || !bot.running || ranked.length === 0) return
    const now = Date.now()
    updateBot(qk, recordTick(rebalance(bot, topSymbols, priceMap, now), priceMap, now))
  }

  // Auto tick + rebalance whenever fresh prices/rankings arrive.
  useEffect(() => {
    const b = bots[qk]
    if (!b || !b.running || ranked.length === 0 || Object.keys(priceMap).length === 0) return
    const now = Date.now()
    let next = b
    const canRebalance = b.lastRebalance == null || now - b.lastRebalance >= MIN_AUTO_REBALANCE_MS
    if (canRebalance && needsRebalance(b, topSymbols.filter((s) => priceMap[s]))) {
      next = rebalance(next, topSymbols, priceMap, now)
    }
    next = recordTick(next, priceMap, now)
    updateBot(qk, next)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [priceMap]) // one pass per fresh price map; rankings ride along

  // ---- selection ------------------------------------------------------------
  const [selectedId, setSelectedId] = useState(null)
  const selected = ranked.find((a) => a.id === selectedId) || ranked[0] || null
  useEffect(() => {
    setSelectedId(null)
  }, [assetClass, stockMode])

  const recentLabel = assetClass === 'crypto' ? '24h %' : '1w %'
  const showGbm = selected && !isSnapshot && selected.prim.returns

  const rankedWithSus = useMemo(
    () => ranked.map((a) => (susMap[a.symbol] ? { ...a, sus: susMap[a.symbol] } : a)),
    [ranked, susMap],
  )
  const susRanked = useMemo(
    () => rankedWithSus.filter((a) => a.sus).slice().sort((x, y) => y.sus.score - x.sus.score),
    [rankedWithSus],
  )
  const overlayStatus =
    assetClass === 'stocks'
      ? [
          { key: 'edgar', label: `EDGAR Form 4: ${insider.status === 'ready' ? 'live' : insider.status}`, ok: insider.status === 'ready', detail: 'SEC insider-transaction filing counts per ticker, last 30 days (efts.sec.gov full-text search)' },
          { key: 'pol', label: `lawmaker feed: ${polFeed.status === 'ready' ? 'live' : polFeed.status === 'idle' ? 'not set' : polFeed.status}`, ok: polFeed.status === 'ready', detail: 'STOCK Act trade disclosures from a user-supplied feed — public mirrors (Senate/House Stock Watcher) are dead' },
        ]
      : [
          { key: 'computed', label: 'computed anomalies: live', ok: true, detail: 'turnover, price–volume divergence, volatility regime spike, pump extremity — from the CoinGecko data already loaded' },
        ]

  return (
    <div style={{ minHeight: '100vh', background: T.bg, fontFamily: FONTS.sans, color: T.ink }}>
      <div style={{ maxWidth: 1200, margin: '0 auto', padding: '0 20px 40px' }}>
        <Header
          cryptoStatus={crypto.status}
          countdown={assetClass === 'crypto' ? countdown : null}
          onRefresh={refreshCrypto}
          isCrypto={assetClass === 'crypto'}
        />

        <QuadrantSelector assetClass={assetClass} horizon={horizon} onAssetClass={switchAssetClass} onHorizon={setHorizon} />

        {/* Risk disclaimer — non-negotiable */}
        <div
          style={{
            ...S.fadeIn,
            display: 'flex', gap: 10, alignItems: 'flex-start',
            border: `1px solid ${T.amber}55`, background: `${T.amber}0d`,
            borderRadius: 10, padding: '12px 14px', marginBottom: 16,
          }}
        >
          <AlertTriangle size={16} color={T.amber} style={{ flexShrink: 0, marginTop: 1 }} />
          <div style={{ fontSize: 12, lineHeight: 1.6, color: T.dim }}>
            <b style={{ color: T.amber }}>This ranks the past, not the future.</b> Every number here describes recent
            statistical behavior; none of it predicts returns. High recent scores routinely precede losses. This is an
            analytical toy for personal study — <b style={{ color: T.amber }}>not financial advice</b>.
          </div>
        </div>

        {crypto.status === 'stale' && assetClass === 'crypto' && (
          <div style={{ ...S.mono, fontSize: 11, color: T.amber, border: `1px solid ${T.amber}44`, borderRadius: 8, padding: '8px 12px', marginBottom: 16 }}>
            ⚠ Live refresh failing ({crypto.error}) — showing the last good snapshot. Retrying every {REFRESH_SECONDS}s.
          </div>
        )}

        {assetClass === 'stocks' && (
          <>
            <DataSourcePanel
              mode={stockMode}
              onMode={setStockMode}
              symbols={symbolsText}
              onSymbols={persist('symbols', setSymbolsText)}
              customProxy={customProxy}
              onCustomProxy={persist('customProxy', setCustomProxy)}
              ghUrl={ghUrl}
              onGhUrl={persist('ghUrl', setGhUrl)}
              apiKey={apiKey}
              onApiKey={persist('apiKey', setApiKey)}
              status={equity.status}
              progress={progress}
              summary={equity.summary}
              error={null}
              log={relayLog}
              onLoad={loadEquities}
              onClearSettings={handleClearSettings}
            />
            <VixCard />
          </>
        )}

        {assetClass === 'crypto' && crypto.status === 'error' && (
          <ErrorCard title="CoinGecko unreachable" message={crypto.error || 'Unknown error'} onRetry={refreshCrypto} />
        )}
        {assetClass === 'stocks' && equity.status === 'error' && (
          <ErrorCard title="Equity load failed" message={equity.error || 'Unknown error'} onRetry={loadEquities} />
        )}

        <WeightsPanel weights={weights} onChange={setWeight} onReset={resetWeights} volSign={preset.volSign} momKey={preset.momKey} />

        {assetClass === 'stocks' && !isSnapshot && equity.status === 'idle' && (
          <div style={{ ...S.panel, padding: 24, marginBottom: 16, textAlign: 'center', color: T.faint, fontFamily: FONTS.mono, fontSize: 12 }}>
            Pick a data mode above and hit LOAD DATA to build the equity universe.
          </div>
        )}
        {assetClass === 'crypto' && crypto.status === 'loading' && (
          <div style={{ ...S.panel, padding: 24, marginBottom: 16, textAlign: 'center', color: T.faint, fontFamily: FONTS.mono, fontSize: 12 }}>
            Loading crypto universe from CoinGecko…
          </div>
        )}

        <Top5
          ranked={ranked}
          selectedId={selected?.id}
          onSelect={setSelectedId}
          showBeta={(weights.beta || 0) > 0}
          recentLabel={recentLabel}
        />

        {showGbm && <ProjectionChart asset={selected} />}

        {!isSnapshot && ranked.length > 0 && (
          <PaperBot
            bot={bot}
            prices={priceMap}
            topSymbols={topSymbols}
            onStart={startBot}
            onToggle={toggleBot}
            onRebalance={rebalanceBotNow}
            onReset={resetBot}
          />
        )}

        {!isSnapshot && susRanked.length > 0 && (
          <SusPanel
            susRanked={susRanked}
            assetClass={assetClass}
            overlayStatus={overlayStatus}
            polFeedUrl={polFeedUrl}
            onPolFeedUrl={persist('polFeedUrl', setPolFeedUrl)}
            onLoadPolFeed={loadPolFeedNow}
            polTrades={polFeed.recent}
          />
        )}
        {assetClass === 'crypto' && crypto.coins.length > 0 && <WhaleTicker btcUsd={priceMap.BTC || 0} />}

        <UniverseTable
          ranked={rankedWithSus}
          isSnapshot={isSnapshot}
          selectedId={selected?.id}
          onSelect={setSelectedId}
          momKey={preset.momKey}
          recentLabel={recentLabel}
        />

        {!isSnapshot && <CorrMatrix assets={ranked} />}

        <Methodology />

        <footer style={{ borderTop: `1px solid ${T.line}`, paddingTop: 14, fontSize: 11, color: T.faint, lineHeight: 1.7 }}>
          Quant Terminal — descriptive statistics on recent market behavior. Data: CoinGecko · Yahoo (unofficial) ·
          Stooq · TwelveData · datasets/finance-vix. Public CORS relays are third parties and see requested ticker URLs.
          Nothing here is investment advice or a solicitation. Settings persist in your browser's localStorage only.
        </footer>
      </div>
    </div>
  )
}
