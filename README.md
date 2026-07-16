# Quant Terminal

A four-quadrant multi-factor statistical ranker for **{Crypto | Stocks & ETFs} ×
{Day Trading | Long-Term}** — one engine, four calibrations. It z-scores each
factor *within* the current universe (momentum, volatility, liquidity, trend,
drawdown resilience, beta), blends them with per-quadrant weights, and ranks the
result.

> **This ranks the past, not the future.** Everything here is descriptive
> statistics on recent behavior — not predictions, not financial advice.

Built with Vite + React 18, recharts and lucide-react. No CSS framework; design
tokens live in `src/theme.js`.

## Run / build / test

```bash
npm install
npm run dev       # http://localhost:5173 — crypto quadrants go live in seconds
npm test          # Vitest unit tests for src/lib/math.js
npm run build     # static build in dist/
npm run preview   # serve the production build locally
```

## Data sources

**Crypto** loads live from CoinGecko (no key needed, CORS-open) and refreshes
every 60 s with a visible countdown. Stablecoins and wrapped/staked derivatives
are filtered out; the top 22 by market cap remain. On failure the last good
snapshot is kept and flagged stale.

**Equities** offer four user-selectable modes, because browsers cannot call
Yahoo or Stooq directly (no CORS headers):

1. **Keyless relays** (default) — Yahoo's unofficial chart endpoint with Stooq
   as per-symbol fallback, routed through a transport chain: direct fetch →
   your custom relay (optional) → allorigins → codetabs → cors.x2u.in →
   killcors. The first relay that works is preferred for subsequent symbols.
   Every failure lands in a visible relay log. Note: relays are third parties —
   they see the ticker URLs you request. `corsproxy.io` is deliberately
   excluded (its free tier became localhost-only and fails silently when
   deployed).
2. **GitHub feed** (most durable, zero proxy) — `raw.githubusercontent.com`
   serves public files with `Access-Control-Allow-Origin: *`, so a public repo
   publishing `docs/prices.json` is a keyless, proxy-free data source. Enter
   `user/repo` or a full raw URL. The bundled kit in
   [`public/gh-feed/`](public/gh-feed/README.md) (yfinance script + GitHub
   Action) produces a conforming feed. Schema:
   `{ "updated": ISO8601, "series": { "SPY": { "closes": [...], "volumes": [...] } } }`
   with >40 closes required per symbol.
3. **API key** — TwelveData daily series with your own key (free tier ≈ 8
   req/min, 800/day; requests are paced and rate-limit stops are reported).
   The key is stored in your browser's localStorage only.
4. **Snapshot** — a static, clearly-labeled *indicative* six-ticker snapshot
   (early June 2026) that never fails. Missing fields render as "—" and rank
   neutrally.

The **VIX context card** (stocks view) demonstrates the GitHub pattern: it
fetches `datasets/finance-vix` straight from raw.githubusercontent.com (with a
jsDelivr fallback) and hides silently if all mirrors fail.

## Engine notes

- Z-scores are computed within the current universe only — never across asset
  classes. That is the calibration point: "high vol" ≈ 80 %+ for crypto vs
  ≈ 40 % for equities.
- Volatility's sign flips by horizon: rewarded for day trading, penalized
  long-term. Momentum uses a short blend (day) or long blend (long-term).
- Missing data is shown as "—" and contributes z = 0; nothing is invented.
- The 30-day GBM Monte Carlo fan (300 paths, Box–Muller, μ clamped to ±2,
  σ floored at 0.01) is a model band, **not a forecast** — real tails are
  fatter.

## Persistence

API key, symbols, custom relay, GitHub feed URL, equity mode and per-quadrant
weight overrides persist in localStorage. A "clear saved settings" control wipes
everything. Switching equity modes or quadrants aborts in-flight fetches.

## Deploy to GitHub Pages

`.github/workflows/pages.yml` builds `dist/` and deploys it to GitHub Pages on
every push to `main` (enable *Settings → Pages → Source: GitHub Actions*). The
Vite base is `./`, so the build works from any subpath.
