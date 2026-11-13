#!/usr/bin/env python3
"""Fail-closed pre-publication same-session and vintage gate for NEW morning briefs.

Only run for a PR which changes the published morning-brief/latest.json. Existing
published archives or code-only PRs must not be retrospectively re-authored.
No external network, market estimation, private data or trading authorization.
"""
from __future__ import annotations

import json
from datetime import datetime
from pathlib import Path

from observatory_session import expected_completed_session

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "market-observatory" / "data"
REQUIRED = ("NASDAQ100", "SP500", "VIX")


def _stamp(text):
    stamp = datetime.fromisoformat(str(text or ""))
    if stamp.tzinfo is None:
        raise ValueError("UNZONED_SOURCE_CLOCK")
    return stamp


def verify(brief, observatory, pulse, glance):
    """Return same-session evidence or raise ValueError; never certify price."""
    try:
        session = brief["market_date_us"]
        checked = _stamp(brief["editorial_contract"]["verified_at_kst"])
        written = _stamp(brief["generated_kst"])
        published = _stamp(brief["published_kst"])
        obs_time = _stamp(observatory["generated_kst"])
        pulse_time = _stamp(pulse["generated_kst"])
        glance_time = _stamp(glance["generated_kst"])
        source_time = _stamp(glance["source_generated_kst"])
        if session != expected_completed_session(checked):
            raise ValueError("BRIEF_WRONG_COMPLETED_SESSION")
        if not (observatory["us_completed_session_date"] == session
                == pulse["market_date_us"] == glance["us_session"]
                == glance["tripod"]["session"]):
            raise ValueError("CANONICAL_SESSION_NOT_READY")
        if not (pulse["snapshot_status"] == "FINAL"
                and pulse["session_gate"]["aligned"] is True
                and pulse["read_only"] is True
                and glance["read_only"] is True
                and glance["no_trade"] is True
                and glance["consistency"]["status"] == "OK"):
            raise ValueError("CANONICAL_STATUS_NOT_READY")
        if any(pulse["session_gate"]["core_dates"].get(k) != session for k in REQUIRED):
            raise ValueError("PULSE_CORE_DATES_STALE")
        series = observatory["series"]
        if any(not series.get(k) or series[k][-1].get("date") != session for k in REQUIRED):
            raise ValueError("OBSERVATORY_CORE_DATES_STALE")
        if source_time != obs_time:
            raise ValueError("GLANCE_VINTAGE_NOT_MATCHING_OBSERVATORY")
        if not (obs_time <= pulse_time <= glance_time <= checked <= written <= published):
            raise ValueError("REPORT_PREDATES_CANONICAL_SOURCE")
        if brief.get("read_only") is not True or brief.get("contains_account_data") is not False:
            raise ValueError("PUBLIC_READ_ONLY_GATE")
        # Status FINAL means completed session, *not* independently verified
        # official EOD. NDX/SOX still retain independent strict close checks.
        return {"session": session, "source_generated_kst": observatory["generated_kst"],
                "pulse_generated_kst": pulse["generated_kst"],
                "glance_generated_kst": glance["generated_kst"],
                "official_close_verified": False}
    except (KeyError, TypeError, IndexError) as error:
        raise ValueError("CANONICAL_EVIDENCE_INCOMPLETE") from error


def main():
    def read(path):
        return json.loads(path.read_text(encoding="utf-8"))
    try:
        proof = verify(read(DATA / "morning-brief" / "latest.json"),
                       read(DATA / "observatory.json"),
                       read(DATA / "daily-market-pulse.json"),
                       read(DATA / "daily-glance.json"))
    except (ValueError, OSError) as error:
        print(f"MORNING_BRIEF_CANONICAL_READINESS=BLOCKED reason={error}")
        return 1
    print("MORNING_BRIEF_CANONICAL_READINESS=PASS", proof)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
