# sus-feed kit — lawmaker (STOCK Act) trade feed

The Suspicion radar can overlay publicly disclosed trades by U.S. lawmakers.
The once-popular public mirrors — Senate Stock Watcher and House Stock Watcher
S3 buckets — are **dead** (they return `AccessDenied`; verified July 2026). The
terminal refuses to fake that data, so this overlay takes a feed **you** host,
using the same raw-GitHub CORS pattern as the price feed.

## Feed schema (`docs/congress.json` in a public repo)

```json
{
  "updated": "2026-07-16T00:00:00Z",
  "trades": [
    {
      "ticker": "NVDA",
      "chamber": "house",
      "name": "Rep. Example Person",
      "side": "buy",
      "date": "2026-07-01",
      "amount": "$1,001 - $15,000"
    }
  ]
}
```

- Enter `user/repo` in the radar panel (resolves to
  `raw.githubusercontent.com/user/repo/main/docs/congress.json`, then `master`,
  then the jsDelivr mirror) or paste a full raw URL.
- The radar counts trades per ticker over the last 90 days and lists the most
  recent ones.

## Where to get the data

Disclosures are public records: the House Clerk
(disclosures-clerk.house.gov) and Senate eFD (efdsearch.senate.gov) publish
them; commercial APIs (QuiverQuant, Finnhub, FMP) offer parsed versions on
free tiers you could export from on a schedule with a GitHub Action —
mirroring `public/gh-feed/update-feed.yml`.

## Honesty rules baked into the app

- STOCK Act disclosures are **legal filings**. Showing them is journalism-grade
  transparency, not an accusation of insider trading — the app labels them so.
- A missing feed contributes **nothing** to suspicion scores (absence of data
  is never treated as evidence).
