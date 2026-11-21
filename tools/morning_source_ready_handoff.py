#!/usr/bin/env python3
"""Zero-LLM, source-ready event gate. Emits evidence; NEVER writes an editorial."""
from __future__ import annotations

import json
import os
import sys
from datetime import datetime, time, timedelta
from pathlib import Path
from zoneinfo import ZoneInfo

sys.path.insert(0, str(Path(__file__).resolve().parent))
from check_morning_publication import decide, PUBLICATION_WEEKDAYS
from observatory_session import expected_completed_session, trading_day

KST = ZoneInfo("Asia/Seoul")


def assess(now, observatory, pulse, public, glance, sectors, latest, index, archive):
    now = now.astimezone(KST)
    day = now.date().isoformat()
    expected = expected_completed_session(now)
    due = (
        now.weekday() in PUBLICATION_WEEKDAYS
        and trading_day(now.date() - timedelta(days=1))
        and now.time() >= time(6, 30)
    )
    source_data = [observatory, pulse, public, glance, sectors, latest, index, archive]
    observatory, pulse, public, glance, sectors, latest, index, archive = [
        value if isinstance(value, dict) else {} for value in source_data
    ]
    report_problems = decide(now, latest, observatory, index=index, archive=archive)
    missing = [p for p in report_problems if p.startswith("BRIEF_MISSING")]
    signal = public.get("tripod_signal") or {}
    if not isinstance(signal, dict):
        signal = {}
    groups = sectors.get("groups") or []
    if not isinstance(groups, list):
        groups = []
    sector_rows, sector_keys = [], {}
    for group in groups:
        if not isinstance(group, dict):
            continue
        rows = group.get("rows") or []
        if not isinstance(rows, list):
            continue
        sector_rows.extend(row for row in rows if isinstance(row, dict))
        sector_keys[group.get("key")] = len(rows)
    source_ready = bool(
        observatory.get("us_completed_session_date") == expected
        and pulse.get("market_date_us") == expected
        and pulse.get("snapshot_status") == "FINAL"
        and (pulse.get("session_gate") or {}).get("aligned") is True
        and pulse.get("read_only") is True
        and signal.get("date") == expected
        and signal.get("ok") is True
        and public.get("read_only") is True
        and glance.get("us_session") == expected
        and (glance.get("tripod") or {}).get("session") == expected
        and (glance.get("consistency") or {}).get("status") == "OK"
        and glance.get("read_only") is True
        and glance.get("no_trade") is True
        and (sectors.get("completed_cutoffs") or {}).get("US") == expected
        and len(sector_rows) == 34
        and sector_keys.get("classic") == 11
        and sector_keys.get("kr_sector") == 10
        and all(r.get("status") == "OK" for r in sector_rows)
    )
    status = ("NOT_DUE" if not due else
              "SOURCE_PENDING" if not source_ready else
              "SOURCE_READY_UNPUBLISHED" if missing else
              "PUBLISHED")
    return {
        "status": status, "report_date_kst": day, "market_date_us": expected,
        "due": due, "source_ready": source_ready,
        "needs_handoff": due and source_ready and bool(missing),
        "brief_problems": missing,
        "source_sessions": {
            "observatory": observatory.get("us_completed_session_date"),
            "pulse": pulse.get("market_date_us"),
            "tripod": signal.get("date"),
            "glance": glance.get("us_session"),
            "sectors_us": (sectors.get("completed_cutoffs") or {}).get("US"),
        },
        "sector_rows": len(sector_rows),
        "latest_date": latest.get("report_date_kst"),
        "latest_market_us": latest.get("market_date_us"),
    }


def run():
    root = Path(__file__).resolve().parents[1] / "market-observatory" / "data"
    paths = {
        "observatory": root / "observatory.json",
        "pulse": root / "daily-market-pulse.json",
        "public": root.parents[1] / "public-market-daily.json",
        "glance": root / "daily-glance.json",
        "sector": root / "sector-rotation-brief.json",
        "latest": root / "morning-brief/latest.json",
        "index": root / "morning-brief/index.json",
    }
    def read(path):
        try: return json.loads(path.read_text(encoding="utf-8"))
        except (OSError, ValueError): return {}
    now = datetime.now(KST)
    archive = read(root / "morning-brief" / (now.strftime("%Y%m%d") + ".json"))
    args = [read(paths[k]) for k in ("observatory", "pulse", "public", "glance", "sector", "latest", "index")]
    state = assess(now, *args, archive)
    print("MORNING_SOURCE_READY_HANDOFF", json.dumps(state, ensure_ascii=False, sort_keys=True))
    if os.environ.get("GITHUB_OUTPUT"):
        with open(os.environ["GITHUB_OUTPUT"], "a", encoding="utf-8") as out:
            for k, v in {
                "needed": "true" if state["needs_handoff"] else "false",
                "report_day": state["report_date_kst"],
                "us_session": state["market_date_us"],
                "status": state["status"],
            }.items():
                out.write(f"{k}={v}\n")
    return 0  # A status-only gate never creates red alert storms on its own.


if __name__ == "__main__":
    sys.exit(run())
