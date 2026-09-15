#!/usr/bin/env python3
from __future__ import annotations

import base64
import json
import os
from datetime import date, datetime, timedelta, timezone
from pathlib import Path
from zoneinfo import ZoneInfo

from curl_cffi import requests

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "market-observatory" / "data" / "fed-watch.json"
PREV_DEFAULT = Path("/tmp/fed-watch-prev.json")
KST = ZoneInfo("Asia/Seoul")
ET = ZoneInfo("America/New_York")
UA = "Mozilla/5.0 JJOONI-FedWatch-Official/1.0"
AUTH_URL = "https://auth.cmegroup.com/as/token.oauth2"
EOD_BASE = "https://markets.api.cmegroup.com/fedwatch/v1"
RT_BASE = "https://markets.api.cmegroup.com/fedwatch_rt/v1"
FRED_CSV = "https://fred.stlouisfed.org/graph/fredgraph.csv"


def _session():
    return requests.Session(impersonate="chrome")


def _business_day(d: date) -> date:
    while d.weekday() >= 5:
        d -= timedelta(days=1)
    return d


def _prev_business_day(d: date) -> date:
    return _business_day(d - timedelta(days=1))


def _expected_reporting_date(now_utc: datetime) -> date:
    """Expected latest CME FedWatch EOD reporting date.

    CME documents the EOD API as updating on business days at 01:45 UTC.
    Before that publication window, expect the prior business day's prior
    snapshot; after it, expect the immediately preceding U.S. business day.
    """
    et_day = now_utc.astimezone(ET).date()
    expected = _prev_business_day(et_day)
    if now_utc.time() < datetime.strptime("01:45", "%H:%M").time():
        expected = _prev_business_day(expected)
    return expected


def _fred_latest(series_id: str, lookback_days: int = 20) -> tuple[float, str]:
    end = datetime.now(ET).date()
    start = end - timedelta(days=lookback_days)
    r = _session().get(
        FRED_CSV,
        params={"id": series_id, "cosd": start.isoformat(), "coed": end.isoformat()},
        headers={"User-Agent": UA},
        timeout=25,
    )
    r.raise_for_status()
    for line in reversed(r.text.strip().splitlines()[1:]):
        parts = line.split(",")
        if len(parts) == 2 and parts[1] not in ("", "."):
            return float(parts[1]), parts[0]
    raise RuntimeError(f"FRED_NO_VALUE:{series_id}")


def _oauth_token(api_id: str, password: str) -> str:
    raw = base64.b64encode(f"{api_id}:{password}".encode("utf-8")).decode("ascii")
    r = _session().post(
        AUTH_URL,
        headers={
            "Authorization": f"Basic {raw}",
            "Content-Type": "application/x-www-form-urlencoded",
            "User-Agent": UA,
        },
        data={"grant_type": "client_credentials"},
        timeout=25,
    )
    r.raise_for_status()
    token = str((r.json() or {}).get("access_token") or "").strip()
    if not token:
        raise RuntimeError("CME_OAUTH_NO_ACCESS_TOKEN")
    return token


def _fetch_latest(token: str, mode: str) -> dict:
    base = RT_BASE if mode == "intraday" else EOD_BASE
    r = _session().get(
        f"{base}/forecasts/latest",
        headers={
            "Authorization": f"Bearer {token}",
            "Accept": "application/json",
            "CME-Application-Name": "JJOONI Market Observatory",
            "CME-Application-Vendor": "JJOONI",
            "User-Agent": UA,
        },
        timeout=30,
    )
    r.raise_for_status()
    data = r.json() or {}
    payload = data.get("payload") or []
    if not payload:
        raise RuntimeError("CME_FEDWATCH_EMPTY_PAYLOAD")
    row = payload[0]
    if not row.get("meetingDt") or not row.get("rateRange"):
        raise RuntimeError("CME_FEDWATCH_MALFORMED_PAYLOAD")
    return row


def _target_label(lower: float, upper: float) -> str:
    return f"{lower:.2f}-{upper:.2f}"


def _parse_range_bps(item: dict) -> tuple[int, int, float]:
    lo = int(item.get("lowerRt"))
    hi = int(item.get("upperRt"))
    p = float(item.get("probability") or 0.0)
    return lo, hi, max(0.0, min(1.0, p))


def _outcomes(rate_ranges: list[dict], current_lower: float, current_upper: float) -> list[dict]:
    cur_lo_bp = round(current_lower * 100)
    cur_hi_bp = round(current_upper * 100)
    out = []
    for item in rate_ranges:
        lo, hi, p = _parse_range_bps(item)
        move_bp = lo - cur_lo_bp
        if move_bp == 0 and hi == cur_hi_bp:
            action = "HOLD"
        elif move_bp > 0:
            action = f"HIKE_{move_bp}BP"
        elif move_bp < 0:
            action = f"CUT_{abs(move_bp)}BP"
        else:
            action = "OTHER"
        out.append(
            {
                "action": action,
                "move_bp": move_bp,
                "target": _target_label(lo / 100.0, hi / 100.0),
                "probability": round(p, 6),
            }
        )
    total = sum(x["probability"] for x in out)
    if total <= 0:
        raise RuntimeError("CME_FEDWATCH_ZERO_PROBABILITY")
    for x in out:
        x["probability"] = round(x["probability"] / total, 6)
    return out


def _summary(outcomes: list[dict]) -> dict:
    return {
        "hold_probability": round(sum(x["probability"] for x in outcomes if x["move_bp"] == 0), 6),
        "hike_any_probability": round(sum(x["probability"] for x in outcomes if x["move_bp"] > 0), 6),
        "hike_25bp_probability": round(sum(x["probability"] for x in outcomes if x["move_bp"] == 25), 6),
        "cut_any_probability": round(sum(x["probability"] for x in outcomes if x["move_bp"] < 0), 6),
        "cut_25bp_probability": round(sum(x["probability"] for x in outcomes if x["move_bp"] == -25), 6),
    }


def _load_previous() -> dict | None:
    p = Path(os.getenv("FEDWATCH_PREVIOUS_FILE", str(PREV_DEFAULT)))
    try:
        if p.exists():
            d = json.loads(p.read_text(encoding="utf-8"))
            if str(d.get("source_mode") or "").startswith("CME_OFFICIAL_API"):
                return d
    except Exception:
        pass
    return None


def _history(previous: dict | None, reporting_date: str, summary: dict) -> list[dict]:
    rows = []
    if previous:
        for x in previous.get("history") or []:
            if x.get("trade_date") and x.get("trade_date") != reporting_date:
                rows.append(x)
    rows.append({"trade_date": reporting_date, **summary})
    dedup = {x["trade_date"]: x for x in rows if x.get("trade_date")}
    return [dedup[k] for k in sorted(dedup)[-30:]]


def _nearest(history: list[dict], target: date) -> dict | None:
    rows = [x for x in history if x.get("trade_date") and date.fromisoformat(x["trade_date"]) <= target]
    return rows[-1] if rows else None


def _delta(summary: dict, ref: dict | None) -> float | None:
    if not ref:
        return None
    return round((summary["hike_any_probability"] - float(ref.get("hike_any_probability") or 0.0)) * 100.0, 2)


def main() -> int:
    api_id = os.getenv("CME_FEDWATCH_API_ID", "").strip()
    password = os.getenv("CME_FEDWATCH_API_PASSWORD", "").strip()
    mode = os.getenv("CME_FEDWATCH_API_MODE", "eod").strip().lower()
    if mode not in {"eod", "intraday"}:
        mode = "eod"
    if not api_id or not password:
        print("FEDWATCH_OFFICIAL_API=SKIP:NO_CREDENTIALS")
        return 0

    try:
        token = _oauth_token(api_id, password)
        row = _fetch_latest(token, mode)
        lower, lower_date = _fred_latest("DFEDTARL")
        upper, upper_date = _fred_latest("DFEDTARU")
        effr, effr_date = _fred_latest("EFFR")
        outcomes = _outcomes(row.get("rateRange") or [], lower, upper)
        summary = _summary(outcomes)

        reporting_date = str(row.get("reportingDt") or "")[:10]
        if not reporting_date:
            calc = str(row.get("calculationTimestamp") or "")
            reporting_date = calc[:10]
        if not reporting_date:
            raise RuntimeError("CME_FEDWATCH_NO_REPORTING_DATE")

        now_kst = datetime.now(KST)
        now_utc = now_kst.astimezone(timezone.utc)
        expected = _expected_reporting_date(now_utc)
        gap_business_days = 0
        cursor = date.fromisoformat(reporting_date)
        while cursor < expected:
            cursor += timedelta(days=1)
            if cursor.weekday() < 5:
                gap_business_days += 1
        freshness = "LIVE" if gap_business_days == 0 else "STALE"

        previous = _load_previous()
        history = _history(previous, reporting_date, summary)
        report_day = date.fromisoformat(reporting_date)
        one_day = _nearest(history[:-1], _prev_business_day(report_day))
        one_week = _nearest(history[:-1], report_day - timedelta(days=7))

        source_mode = "CME_OFFICIAL_API_INTRADAY" if mode == "intraday" else "CME_OFFICIAL_API_EOD"
        out = {
            "schema": "JJOONI_FED_WATCH_V1",
            "generated_kst": now_kst.isoformat(timespec="seconds"),
            "read_only": True,
            "contains_account_data": False,
            "source": "CME FedWatch official API",
            "source_mode": source_mode,
            "source_priority": "CME_PRIMARY_OFFICIAL_API",
            "calculation_contract": "CME_OFFICIAL_FEDWATCH_API_V1",
            "official_api_status": "CONFIGURED_AND_USED",
            "meeting_date": str(row.get("meetingDt"))[:10],
            "market_data_as_of": reporting_date,
            "expected_market_data_date": expected.isoformat(),
            "observed_at": now_kst.isoformat(timespec="seconds"),
            "calculation_timestamp": row.get("calculationTimestamp"),
            "freshness": freshness,
            "current_target": _target_label(lower, upper),
            "current_target_lower": lower,
            "current_target_upper": upper,
            "effr": effr,
            "effr_date": effr_date,
            "outcomes": outcomes,
            **summary,
            "change_1d_pctpt": _delta(summary, one_day),
            "change_1w_pctpt": _delta(summary, one_week),
            "history": history,
            "calculation": {
                "provider": "CME FedWatch API",
                "product_code": row.get("productCode"),
                "current_reporting_rate": row.get("currentReportingRt"),
            },
            "quality": {
                "state": "PASS" if freshness == "LIVE" else "DEGRADED",
                "cme_reporting_business_day_gap": gap_business_days,
                "fred_target_dates": {"lower": lower_date, "upper": upper_date, "effr": effr_date},
                "history_points": len(history),
            },
            "provenance": {
                "cme_fedwatch_api": RT_BASE if mode == "intraday" else EOD_BASE,
                "cme_auth": AUTH_URL,
                "cme_documentation": "https://www.cmegroup.com/market-data/market-data-api/fedwatch-api.html",
                "fred": FRED_CSV,
            },
            "usage_contract": {
                "strategy_usable": freshness == "LIVE",
                "stale_rule": "If freshness != LIVE, do not use probability as a current strategy fact; refresh or web-verify CME FedWatch.",
                "attribution": "CME FedWatch official API probability.",
            },
        }
        OUT.write_text(json.dumps(out, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
        print("FEDWATCH_OFFICIAL_API=PASS")
        print("mode=", mode)
        print("meeting=", out["meeting_date"])
        print("market_data_as_of=", out["market_data_as_of"])
        print("hike_any_probability=", out["hike_any_probability"])
        print("freshness=", out["freshness"])
        return 0
    except Exception as exc:
        # The settlement-derived builder runs first and remains the safe fallback.
        print(f"FEDWATCH_OFFICIAL_API=DEGRADED:{type(exc).__name__}:{exc}")
        return 0


if __name__ == "__main__":
    raise SystemExit(main())
