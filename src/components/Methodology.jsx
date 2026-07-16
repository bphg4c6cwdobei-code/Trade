import React from 'react'
import { BookOpen } from 'lucide-react'
import { T, FONTS, S } from '../theme.js'

const CARDS = [
  {
    title: 'One engine, four calibrations',
    body: 'Every quadrant runs the same pipeline: per-asset primitives → z-scores WITHIN the current universe → weighted composite. Z-scoring never crosses asset classes, because the scales differ wildly — 80% annualized volatility is ordinary for crypto and extreme for equities. The presets only change weights, the volatility sign (rewarded intraday, penalized long-term) and which momentum blend is used.',
  },
  {
    title: 'GitHub fix #1 — the price feed',
    body: 'Browsers cannot call Yahoo or Stooq directly (no CORS headers). But raw.githubusercontent.com serves public files with Access-Control-Allow-Origin: * — so a public repo that publishes prices.json (the bundled gh-feed kit does this with yfinance + a GitHub Action) becomes a durable, keyless, proxy-free data source.',
  },
  {
    title: 'GitHub fix #2 — the VIX card',
    body: 'The VIX context card is the same pattern in miniature: it reads datasets/finance-vix (a maintained public CSV on GitHub) straight from raw.githubusercontent.com, with jsDelivr as fallback. If every mirror fails, the card hides rather than showing stale or fabricated numbers.',
  },
  {
    title: 'The relay caveat',
    body: 'The keyless mode routes Yahoo/Stooq requests through public CORS relays (allorigins, codetabs, cors.x2u.in, killcors). These are third-party services: they can see the ticker URLs you request (nothing more), they rate-limit, and they go down. Every failure is logged visibly. Yahoo\'s chart endpoint is unofficial — fine for personal use, wrong as a product backend. corsproxy.io is deliberately excluded: its free tier only works from localhost and fails silently when deployed.',
  },
  {
    title: 'What the math is (and isn\'t)',
    body: 'Volatility is the sample standard deviation of log returns, annualized. Trend is an OLS slope of log-price scaled by R² — a linear-algebra projection onto a line, rewarding smooth persistent drift. Beta is a covariance ratio vs the benchmark (BTC or SPY). The GBM fan integrates dS = μS·dt + σS·dW with Box–Muller normals. For the theory behind these estimators, see Durrett\'s "Probability: Theory and Examples", Linde\'s "Probability Theory", and Heil\'s "Introduction to Real Analysis"; the regression and z-score machinery is standard linear algebra (least squares as orthogonal projection).',
  },
  {
    title: 'Honesty constraints',
    body: 'This tool ranks RECENT statistical behavior. It is descriptive, not predictive: no price targets, no buy/sell language, no forecasts. Missing data is shown as "—" and contributes neutrally instead of being invented. Snapshot mode is labeled indicative. Real return distributions have fatter tails than every model here assumes.',
  },
]

export default function Methodology() {
  return (
    <section style={{ ...S.fadeIn, marginBottom: 16 }}>
      <h2 style={{ ...S.h2, display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
        <BookOpen size={15} color={T.gold} /> Methodology & honesty notes
      </h2>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(290px, 1fr))', gap: 10 }}>
        {CARDS.map((c) => (
          <div key={c.title} style={{ ...S.panel, padding: 14 }}>
            <div style={{ fontFamily: FONTS.display, fontWeight: 700, fontSize: 14, color: T.gold, marginBottom: 6 }}>{c.title}</div>
            <div style={{ fontFamily: FONTS.sans, fontSize: 12, lineHeight: 1.6, color: T.dim }}>{c.body}</div>
          </div>
        ))}
      </div>
    </section>
  )
}
