#!/usr/bin/env python3
"""Publish ~1y of daily closes/volumes to docs/prices.json for the Quant Terminal.

Run inside a GitHub Action (see update-feed.yml). Requires: pip install yfinance
"""
import json
import pathlib
from datetime import datetime, timezone

import yfinance as yf

SYMBOLS = ["SPY", "QQQ", "NVDA", "MSFT", "GOOGL", "AAPL", "AMZN", "TSLA", "META"]

def main():
    series = {}
    for sym in SYMBOLS:
        try:
            df = yf.Ticker(sym).history(period="1y", interval="1d", auto_adjust=True)
            df = df.dropna(subset=["Close"])
            if len(df) <= 40:
                print(f"skip {sym}: only {len(df)} rows")
                continue
            series[sym] = {
                "closes": [round(float(v), 4) for v in df["Close"].tolist()],
                "volumes": [int(v) for v in df["Volume"].fillna(0).tolist()],
            }
            print(f"ok {sym}: {len(df)} rows")
        except Exception as e:  # keep going — a partial feed beats no feed
            print(f"fail {sym}: {e}")

    if not series:
        raise SystemExit("no symbols fetched; refusing to overwrite the feed")

    out = {
        "updated": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "series": series,
    }
    path = pathlib.Path("docs/prices.json")
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(out))
    print(f"wrote {path} ({len(series)} symbols)")

if __name__ == "__main__":
    main()
