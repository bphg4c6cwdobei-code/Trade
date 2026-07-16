# gh-feed kit — a keyless, proxy-free equity price feed on GitHub

`raw.githubusercontent.com` serves public files with `Access-Control-Allow-Origin: *`,
so a browser app can fetch them directly — no CORS proxy, no API key. This kit
publishes a `docs/prices.json` file from any public repo you own, refreshed daily
by a GitHub Action.

## Setup (5 minutes)

1. Create a **public** GitHub repo (e.g. `youruser/price-feed`).
2. Copy `fetch_prices.py` into the repo root and `update-feed.yml` into
   `.github/workflows/`.
3. Edit the `SYMBOLS` list at the top of `fetch_prices.py`.
4. Commit and push. Run the workflow once by hand (Actions → *Update price feed*
   → *Run workflow*), then it refreshes on the daily schedule.
5. In the Quant Terminal's **GITHUB FEED** mode, enter `youruser/price-feed`.

## Feed schema

```json
{
  "updated": "2026-06-05T21:00:00Z",
  "series": {
    "SPY":  { "closes": [512.3, 514.1], "volumes": [51230000, 48120000] },
    "NVDA": { "closes": [171.2, 172.4], "volumes": [290000000, 310000000] }
  }
}
```

- `closes`/`volumes` are chronological (oldest first), ~1 year of dailies.
- The terminal requires **more than 40 closes** per symbol; shorter series are skipped.
- Shorthand `user/repo` resolves to `raw.githubusercontent.com/user/repo/main/docs/prices.json`,
  then `master`, then the jsDelivr mirror.
