// Transport chain for endpoints that lack CORS headers (Yahoo, Stooq).
// Order: direct fetch → user's custom relay → public relays.
// corsproxy.io is deliberately EXCLUDED: its free tier became localhost-only
// and fails silently from deployed origins. Do not add it back.

export const PUBLIC_RELAYS = [
  {
    id: 'allorigins',
    label: 'allorigins',
    note: '~20/min',
    build: (u) => `https://api.allorigins.win/raw?url=${encodeURIComponent(u)}`,
  },
  {
    id: 'codetabs',
    label: 'codetabs',
    note: '~5/sec',
    build: (u) => `https://api.codetabs.com/v1/proxy/?quest=${encodeURIComponent(u)}`,
  },
  {
    id: 'x2u',
    label: 'cors.x2u.in',
    note: '~100/hr',
    build: (u) => `https://cors.x2u.in/${u}`,
  },
  {
    id: 'killcors',
    label: 'killcors',
    note: '',
    build: (u) => `https://proxy.killcors.com/?url=${encodeURIComponent(u)}`,
  },
]

// Custom relay heuristic: URLs ending in "=" or "?" (or containing "?")
// get the encoded target appended; anything else is treated as a
// path-prefix relay (cors-anywhere style) and gets "/" + raw target.
export function buildCustomRelayUrl(custom, target) {
  const c = custom.trim()
  if (c.endsWith('=') || c.endsWith('?') || c.includes('?')) {
    return c + encodeURIComponent(target)
  }
  return c.replace(/\/+$/, '') + '/' + target
}

export const DIRECT_TIMEOUT_MS = 6000
export const RELAY_TIMEOUT_MS = 9000

export async function fetchTextWithTimeout(url, timeoutMs, outerSignal) {
  const ctrl = new AbortController()
  const onOuterAbort = () => ctrl.abort(outerSignal?.reason)
  if (outerSignal) {
    if (outerSignal.aborted) throw new DOMException('Aborted', 'AbortError')
    outerSignal.addEventListener('abort', onOuterAbort)
  }
  const timer = setTimeout(() => ctrl.abort(new DOMException('Timeout', 'TimeoutError')), timeoutMs)
  try {
    const res = await fetch(url, { signal: ctrl.signal })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const text = await res.text()
    if (!text || text.length === 0) throw new Error('empty response')
    return text
  } finally {
    clearTimeout(timer)
    if (outerSignal) outerSignal.removeEventListener('abort', onOuterAbort)
  }
}

function errText(e) {
  if (e?.name === 'TimeoutError') return 'timeout'
  if (e?.name === 'AbortError') return 'aborted'
  return e?.message || String(e)
}

/**
 * Fetch text through the transport chain.
 * opts: { customProxy, preferRelayId, signal, onLog(line), label }
 * Returns { text, via } where via ∈ 'direct' | 'custom' | relay id.
 * "Adaptive prefer": callers pass back the relay id that last worked so
 * it is tried first for subsequent symbols.
 */
export async function smartFetchText(target, opts = {}) {
  const { customProxy, preferRelayId, signal, onLog, label } = opts
  const log = (msg) => onLog && onLog(`${label ? label + ' · ' : ''}${msg}`)

  const attempts = [{ id: 'direct', url: target, timeout: DIRECT_TIMEOUT_MS }]
  if (customProxy && customProxy.trim()) {
    attempts.push({ id: 'custom', url: buildCustomRelayUrl(customProxy, target), timeout: RELAY_TIMEOUT_MS })
  }
  const relays = PUBLIC_RELAYS.slice()
  if (preferRelayId) {
    const i = relays.findIndex((r) => r.id === preferRelayId)
    if (i > 0) relays.unshift(relays.splice(i, 1)[0])
  }
  for (const r of relays) {
    attempts.push({ id: r.id, url: r.build(target), timeout: RELAY_TIMEOUT_MS })
  }

  let lastErr = null
  for (const a of attempts) {
    if (signal?.aborted) throw new DOMException('Aborted', 'AbortError')
    try {
      const text = await fetchTextWithTimeout(a.url, a.timeout, signal)
      return { text, via: a.id }
    } catch (e) {
      if (e?.name === 'AbortError') throw e
      lastErr = e
      log(`${a.id} failed: ${errText(e)}`)
    }
  }
  throw new Error(`all transports failed (last: ${errText(lastErr)})`)
}

export const sleep = (ms, signal) =>
  new Promise((resolve, reject) => {
    if (signal?.aborted) return reject(new DOMException('Aborted', 'AbortError'))
    const t = setTimeout(() => {
      if (signal) signal.removeEventListener('abort', onAbort)
      resolve()
    }, ms)
    const onAbort = () => {
      clearTimeout(t)
      reject(new DOMException('Aborted', 'AbortError'))
    }
    if (signal) signal.addEventListener('abort', onAbort, { once: true })
  })
