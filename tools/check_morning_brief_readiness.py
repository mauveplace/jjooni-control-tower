#!/usr/bin/env python3
"""Fail-closed pre-publication same-session and vintage gate for NEW morning briefs.

Only run for a PR which changes the published morning-brief/latest.json. Existing
published archives or code-only PRs must not be retrospectively re-authored.
No external network, market estimation, private data or trading authorization.
"""
from __future__ import annotations

import argparse
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


def revision_only(current, baseline):
    """Same dated report + immutable original verification clock = audit revision.

    Existing published EOD source files may be rebuilt long after original
    publication. Do not rewrite historic source vintages to new current values.
    """
    if not isinstance(baseline, dict):
        return False
    original = baseline.get("editorial_contract") or {}
    revised = current.get("editorial_contract") or {}
    before = baseline.get("revisions") or []
    after = current.get("revisions") or []
    if not isinstance(before, list) or not isinstance(after, list):
        return False
    if len(after) <= len(before) or after[:len(before)] != before:
        return False
    return (baseline.get("report_date_kst") == current.get("report_date_kst")
            and baseline.get("market_date_us") == current.get("market_date_us")
            and baseline.get("generated_kst") == current.get("generated_kst")
            and original.get("verified_at_kst") == revised.get("verified_at_kst")
            and bool(after))


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
        vintage = brief["editorial_contract"].get("canonical_source_vintage")
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
        if vintage is not None:
            if (not isinstance(vintage, dict)
                    or vintage.get("session") != session):
                raise ValueError("REPORT_SOURCE_VINTAGE_INVALID")
            seen_obs = _stamp(vintage.get("observatory_generated_kst"))
            seen_pulse = _stamp(vintage.get("pulse_generated_kst"))
            seen_glance = _stamp(vintage.get("glance_generated_kst"))
            if not (seen_obs <= seen_pulse <= seen_glance <= checked <= written <= published):
                raise ValueError("REPORT_PREDATES_CANONICAL_SOURCE")
            # A later same-session Observatory/Glance re-fetch must never
            # retrospectively invalidate a correctly verified report.
            if not (obs_time >= seen_obs and pulse_time >= seen_pulse
                    and glance_time >= seen_glance):
                raise ValueError("SOURCE_VINTAGE_FROM_FUTURE")
        else:
            if brief.get("report_date_kst", "") >= "2026-11-15":
                raise ValueError("CANONICAL_SOURCE_VINTAGE_REQUIRED")
            # Legacy 2026-11-14 report: don't confuse a derived Glance
            # rebuild timestamp with original Observatory vintage.
            if not (obs_time <= pulse_time <= checked <= written <= published):
                raise ValueError("REPORT_PREDATES_CANONICAL_SOURCE")
        if brief.get("read_only") is not True or brief.get("contains_account_data") is not False:
            raise ValueError("PUBLIC_READ_ONLY_GATE")
        # Status FINAL means completed session, *not* independently verified
        # official EOD. NDX/SOX still retain independent strict close checks.
        return {"session": session,
                "source_generated_kst": (vintage or {}).get("observatory_generated_kst", observatory["generated_kst"]),
                "pulse_generated_kst": (vintage or {}).get("pulse_generated_kst", pulse["generated_kst"]),
                "glance_generated_kst": (vintage or {}).get("glance_generated_kst", glance["generated_kst"]),
                "official_close_verified": False}
    except (KeyError, TypeError, IndexError) as error:
        raise ValueError("CANONICAL_EVIDENCE_INCOMPLETE") from error


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--baseline", type=Path, help="Original main latest.json for revision-only detection")
    args = parser.parse_args()
    def read(path):
        return json.loads(path.read_text(encoding="utf-8"))
    try:
        latest = read(DATA / "morning-brief" / "latest.json")
        if args.baseline and args.baseline.exists() and revision_only(latest, read(args.baseline)):
            print("MORNING_BRIEF_CANONICAL_READINESS=REVISION_ONLY original vintage retained")
            return 0
        proof = verify(latest, read(DATA / "observatory.json"),
                       read(DATA / "daily-market-pulse.json"),
                       read(DATA / "daily-glance.json"))
    except (ValueError, OSError) as error:
        print(f"MORNING_BRIEF_CANONICAL_READINESS=BLOCKED reason={error}")
        return 1
    print("MORNING_BRIEF_CANONICAL_READINESS=PASS", proof)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
