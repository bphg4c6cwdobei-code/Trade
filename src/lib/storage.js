// localStorage persistence. Everything lives under one namespaced key so
// "clear saved settings" is a single removal. All access is guarded — the
// app must work with storage disabled (private mode, etc).

const KEY = 'quant-terminal:v1'

export function loadSettings() {
  try {
    const raw = window.localStorage.getItem(KEY)
    if (!raw) return {}
    const obj = JSON.parse(raw)
    return obj && typeof obj === 'object' ? obj : {}
  } catch {
    return {}
  }
}

export function saveSetting(key, value) {
  try {
    const cur = loadSettings()
    cur[key] = value
    window.localStorage.setItem(KEY, JSON.stringify(cur))
  } catch {
    // storage unavailable — settings just won't persist
  }
}

export function clearSettings() {
  try {
    window.localStorage.removeItem(KEY)
  } catch {
    // ignore
  }
}
