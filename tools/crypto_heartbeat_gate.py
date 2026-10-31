#!/usr/bin/env python3
"""Read-only gate for BTC/ETH recovery using existing Observatory heartbeats.

The collector timestamp, not the generated freshness file, determines whether
a quote is usable. No quote or provenance is synthesized by this gate.
"""
import json
from datetime import datetime, timezone
from pathlib import Path

OBS = Path(__file__).resolve().parents[1] / "market-observatory/data/observatory.json"
SYMBOLS = ("BTCUSD", "ETHUSD")
REFRESH_AFTER_SECONDS = 45 * 60
CLOCK_SKEW_SECONDS = 30


def crypto_refresh_decision(observatory, now=None):
    now = now or datetime.now(timezone.utc)
    if now.tzinfo is None:
        raise ValueError("NAIVE_CLOCK")
    quotes = observatory.get("crypto_market") or {}
    details = {}
    for symbol in SYMBOLS:
        quote = quotes.get(symbol) or {}
        try:
            stamp = datetime.fromisoformat(str(quote["quote_as_of_kst"]))
            if stamp.tzinfo is None:
                raise ValueError("UNZONED_QUOTE")
            age = (now - stamp).total_seconds()
            if age < -CLOCK_SKEW_SECONDS:
                raise ValueError("FUTURE_QUOTE")
            age = max(0, age)
        except (KeyError, ValueError, TypeError, OverflowError):
            age = None
        details[symbol] = {
            "age_seconds": None if age is None else int(age),
            "needs_refresh": (
                quote.get("status") != "LIVE"
                or age is None
                or age >= REFRESH_AFTER_SECONDS
            ),
        }
    return {
        "should_refresh": any(v["needs_refresh"] for v in details.values()),
        "details": details,
    }


def main():
    try:
        data = json.loads(OBS.read_text(encoding="utf-8"))
    except (OSError, ValueError):
        data = {}
    result = crypto_refresh_decision(data)
    print("crypto_should_refresh=" + str(result["should_refresh"]).lower())
    print("crypto_quote_max_age_seconds=" + str(
        max((v["age_seconds"] or 0) for v in result["details"].values())
    ))


if __name__ == "__main__":
    main()
