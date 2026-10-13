#!/usr/bin/env python3
"""Compatibility entrypoint for the Observatory FedWatch V2 builder.

Historically Daily Observatory called this path directly. Keep that contract,
but delegate execution to the full conditional-meeting matrix builder. Network
collector helpers remain re-exported for compatibility, while the expected CME
Fed Funds settlement calendar lives in a stdlib-only module shared with audits.
"""
from __future__ import annotations

import json
from datetime import datetime
from pathlib import Path

import fedwatch_core as _core
from fedwatch_trade_calendar import (
    _business_day,
    _cme_fed_funds_holidays,
    _easter_sunday,
    _expected_latest_trade_date,
    _is_trade_day,
    _last_weekday,
    _nth_weekday,
    _observed_fixed,
    _prev_business_day,
)

# Preserve the legacy helper surface expected by the V2 builder.
for _name in dir(_core):
    if not _name.startswith("__"):
        globals()[_name] = getattr(_core, _name)


def _published_snapshot_is_current(path: Path) -> tuple[bool, str]:
    try:
        payload = json.loads(path.read_text(encoding="utf-8"))
    except Exception as exc:
        return False, f"READ_ERROR:{type(exc).__name__}"

    as_of = str(payload.get("market_data_as_of") or "")[:10]
    if not as_of:
        return False, "MARKET_DATA_AS_OF_MISSING"

    expected = _expected_latest_trade_date(datetime.now(_core.ET)).isoformat()
    if as_of < expected:
        return False, f"STALE:{as_of}<{expected}"

    has_distribution = bool(
        payload.get("meeting_probability_matrix")
        or payload.get("probabilities")
        or payload.get("outcomes")
    )
    if not payload.get("meeting_date") or not has_distribution:
        return False, "REQUIRED_FIELDS_MISSING"
    return True, f"CURRENT:{as_of}>={expected}"


def main() -> None:
    from build_fed_watch_v2 import main as build_v2

    existing = Path(__file__).resolve().parents[1] / "market-observatory/data/fed-watch.json"
    if existing.exists():
        current, reason = _published_snapshot_is_current(existing)
        print("FEDWATCH_COMPAT_CHECK=" + reason)
        if current:
            print("FEDWATCH=REUSE_CURRENT_DAILY_SNAPSHOT")
            return

    print("FEDWATCH=REBUILD_V2")
    build_v2()


if __name__ == "__main__":
    main()
