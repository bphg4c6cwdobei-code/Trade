import React from 'react'
import { T, S } from '../theme.js'
import Segmented from './Segmented.jsx'

const BLURBS = {
  'crypto|day':
    'Crypto · Day trading — rewards recent momentum, high realized volatility and deep liquidity. Calibrated to 7-day hourly data.',
  'crypto|long':
    'Crypto · Long-term — penalizes volatility, rewards persistent trend and shallow drawdowns over 7–30 day windows.',
  'stocks|day':
    'Stocks & ETFs · Day trading — rewards short momentum, volatility, dollar liquidity and market beta over ~1y dailies.',
  'stocks|long':
    'Stocks & ETFs · Long-term — favors 3–12 month momentum, smooth trends and drawdown resilience; volatility is penalized.',
}

export default function QuadrantSelector({ assetClass, horizon, onAssetClass, onHorizon }) {
  return (
    <section style={{ ...S.fadeIn, margin: '18px 0' }}>
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
        <div>
          <div style={{ ...S.label, marginBottom: 6 }}>asset class</div>
          <Segmented
            size="lg"
            value={assetClass}
            onChange={onAssetClass}
            options={[
              { value: 'crypto', label: 'CRYPTO' },
              { value: 'stocks', label: 'STOCKS & ETFs' },
            ]}
          />
        </div>
        <div>
          <div style={{ ...S.label, marginBottom: 6 }}>horizon</div>
          <Segmented
            size="lg"
            value={horizon}
            onChange={onHorizon}
            options={[
              { value: 'day', label: 'DAY TRADING' },
              { value: 'long', label: 'LONG-TERM' },
            ]}
          />
        </div>
      </div>
      <p style={{ color: T.dim, fontSize: 13, lineHeight: 1.55, maxWidth: 760, margin: '12px 0 0' }}>
        {BLURBS[`${assetClass}|${horizon}`]}
      </p>
    </section>
  )
}
