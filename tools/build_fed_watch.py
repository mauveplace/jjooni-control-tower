#!/usr/bin/env python3
"""Compatibility entrypoint for the Observatory FedWatch V2 builder.

Historically Daily Observatory called this path directly. Keep that contract,
but delegate execution to the full conditional-meeting matrix builder. Core
settlement helpers are re-exported so existing imports continue to work.

A published snapshot is reused only when it is current for the latest expected
CME Fed Funds settlement date. This prevents an old JSON file from remaining
LIVE forever merely because the file exists.
"""
from __future__ import annotations

import json
from datetime import datetime
from pathlib import Path

import fedwatch_core as _core

# `from module import *` intentionally omits underscore-prefixed helpers, while
# the V2 builder consumes the legacy private helper surface. Re-export the full
# non-dunder module contract explicitly for compatibility.
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

    expected = _core._expected_latest_trade_date(datetime.now(_core.ET)).isoformat()
    if as_of < expected:
        return False, f"STALE:{as_of}<{expected}"

    if not payload.get("meeting_date") or not payload.get("probabilities"):
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
