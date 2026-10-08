#!/usr/bin/env python3
from __future__ import annotations

import json
import math
import sys
from datetime import date, datetime, timedelta
from pathlib import Path
from zoneinfo import ZoneInfo

ROOT = Path(__file__).resolve().parents[1]
TOOLS = ROOT / "tools"
if str(TOOLS) not in sys.path:
    sys.path.insert(0, str(TOOLS))

import build_fed_watch as core

DATA_DIR = ROOT / "market-observatory" / "data"
OUT = DATA_DIR / "fed-watch.json"
KST = ZoneInfo("Asia/Seoul")
ET = ZoneInfo("America/New_York")
MAX_MEETINGS = 12
KNOWN_FOMC_MEETINGS = [
    date(2026, 1, 28), date(2026, 3, 18), date(2026, 4, 29), date(2026, 6, 17),
    date(2026, 7, 29), date(2026, 9, 16), date(2026, 10, 28), date(2026, 12, 9),
    date(2027, 1, 27), date(2027, 3, 17), date(2027, 4, 28), date(2027, 6, 9),
    date(2027, 7, 28), date(2027, 9, 15), date(2027, 10, 27), date(2027, 12, 8),
]


def _load_full_fomc_meetings() -> list[date]:
    """Keep the rolling Observatory calendar, but never truncate the FedWatch horizon to it."""
    calendar_meetings = core._load_fomc_meetings()
    return sorted(set(calendar_meetings) | set(KNOWN_FOMC_MEETINGS))


def _normalize(weights: dict[int, float]) -> dict[int, float]:
    total = sum(max(0.0, float(v)) for v in weights.values())
    if total <= 0:
        return {0: 1.0}
    return {int(k): max(0.0, float(v)) / total for k, v in weights.items() if float(v) > 0}


def convolve_move_distribution(state: dict[int, float], local_distribution: list[dict]) -> dict[int, float]:
    """Convolve conditional 25bp meeting moves into cumulative target-rate nodes."""
    out: dict[int, float] = {}
    for cumulative_moves, state_probability in state.items():
        for node in local_distribution:
            local_moves = int(node.get("move_count_25bp", 0))
            probability = float(node.get("probability", 0.0))
            key = int(cumulative_moves) + local_moves
            out[key] = out.get(key, 0.0) + float(state_probability) * probability
    return _normalize(out)


def _target_label_for_move(move_count: int, current_lower: float, current_upper: float) -> str:
    return core._target_label(current_lower + 0.25 * move_count, current_upper + 0.25 * move_count)


def _target_lower(label: str) -> float:
    return float(str(label).split("-")[0])


def _target_sort_key(label: str) -> tuple[float, str]:
    try:
        return (_target_lower(label), label)
    except Exception:
        return (math.inf, label)


def _matrix_from_settlements(
    settlements: list[dict],
    upcoming_meetings: list[date],
    all_meetings: list[date],
    current_lower: float,
    current_upper: float,
) -> tuple[list[dict], list[str], list[dict]]:
    state: dict[int, float] = {0: 1.0}
    rows: list[dict] = []
    failures: list[dict] = []
    ranges: set[str] = set()

    for meeting in upcoming_meetings[:MAX_MEETINGS]:
        try:
            change = core._meeting_expected_change(meeting, settlements, all_meetings)
            local_distribution = core._move_distribution(change["expected_change_pct"])
            state = convolve_move_distribution(state, local_distribution)
        except Exception as exc:
            failures.append({"meeting_date": meeting.isoformat(), "error": f"{type(exc).__name__}:{exc}"})
            continue

        probabilities: dict[str, float] = {}
        expected_midpoint = 0.0
        current_midpoint = (current_lower + current_upper) / 2.0
        for move_count, probability in sorted(state.items()):
            label = _target_label_for_move(move_count, current_lower, current_upper)
            probabilities[label] = round(float(probability), 8)
            ranges.add(label)
            expected_midpoint += (current_midpoint + move_count * 0.25) * float(probability)

        total = sum(probabilities.values())
        if total > 0:
            probabilities = {k: round(v / total, 8) for k, v in probabilities.items()}

        mode_target, mode_probability = max(probabilities.items(), key=lambda item: item[1])
        above = sum(prob for moves, prob in state.items() if moves > 0)
        same = sum(prob for moves, prob in state.items() if moves == 0)
        below = sum(prob for moves, prob in state.items() if moves < 0)
        rows.append(
            {
                "meeting_date": meeting.isoformat(),
                "probabilities": probabilities,
                "most_likely_target": mode_target,
                "most_likely_probability": round(float(mode_probability), 8),
                "expected_target_midpoint": round(expected_midpoint, 6),
                "probability_above_current": round(above, 8),
                "probability_same_as_current": round(same, 8),
                "probability_below_current": round(below, 8),
                "conditional_move_distribution": local_distribution,
                "conditional_expected_change_bp": round(change["expected_change_pct"] * 100.0, 3),
                "anchor_month": change["anchor_month"],
            }
        )

    return rows, sorted(ranges, key=_target_sort_key), failures


def _fetch_prior_available(start: date, attempts: int = 8) -> tuple[list[dict], date] | tuple[None, None]:
    d = core._business_day(start)
    for _ in range(attempts):
        try:
            return core._fetch_settlements_exact(d)
        except Exception:
            d = core._prev_business_day(d)
    return None, None


def _comparison_map(rows: list[dict]) -> dict[str, dict]:
    return {str(row.get("meeting_date")): row for row in rows}


def _attach_changes(current_rows: list[dict], prior_1d_rows: list[dict], prior_1w_rows: list[dict]) -> None:
    day = _comparison_map(prior_1d_rows)
    week = _comparison_map(prior_1w_rows)
    for row in current_rows:
        meeting = row["meeting_date"]
        current = row.get("probabilities") or {}
        day_probs = (day.get(meeting) or {}).get("probabilities") or {}
        week_probs = (week.get(meeting) or {}).get("probabilities") or {}
        row["change_1d_pp"] = {
            target: round((float(prob) - float(day_probs.get(target, 0.0))) * 100.0, 2)
            for target, prob in current.items()
        } if day_probs else {}
        row["change_1w_pp"] = {
            target: round((float(prob) - float(week_probs.get(target, 0.0))) * 100.0, 2)
            for target, prob in current.items()
        } if week_probs else {}


def _legacy_outcomes(first_row: dict, current_lower: float, current_upper: float) -> list[dict]:
    outcomes = []
    for target, probability in sorted((first_row.get("probabilities") or {}).items(), key=lambda item: _target_sort_key(item[0])):
        move_bp = int(round((_target_lower(target) - current_lower) * 100.0))
        if move_bp == 0:
            action = "HOLD"
        elif move_bp > 0:
            action = f"HIKE_{move_bp}BP"
        else:
            action = f"CUT_{abs(move_bp)}BP"
        outcomes.append(
            {
                "action": action,
                "move_bp": move_bp,
                "target": target,
                "probability": round(float(probability), 8),
            }
        )
    return outcomes


def _summary(outcomes: list[dict]) -> dict:
    return core._summary(outcomes)


def _history_row(trade_date: date, row: dict, current_lower: float, current_upper: float) -> dict:
    outcomes = _legacy_outcomes(row, current_lower, current_upper)
    return {"trade_date": trade_date.isoformat(), **_summary(outcomes)}


def _business_gap(expected: date, actual: date) -> int:
    if actual >= expected:
        return 0
    gap = 0
    d = actual
    while d < expected:
        d += timedelta(days=1)
        if d.weekday() < 5:
            gap += 1
    return gap


def _delta_probability(current: dict, prior: dict | None, key: str) -> float | None:
    if not prior:
        return None
    return round((float(current.get(key, 0.0)) - float(prior.get(key, 0.0))) * 100.0, 2)


def _path_summary(rows: list[dict], current_midpoint: float) -> dict:
    if not rows:
        return {}
    expected = [float(r["expected_target_midpoint"]) for r in rows]
    terminal = rows[-1]
    first_above = next((r for r in rows if float(r.get("probability_above_current", 0.0)) >= 0.5), None)
    first_below = next((r for r in rows if float(r.get("probability_below_current", 0.0)) >= 0.5), None)
    return {
        "current_target_midpoint": round(current_midpoint, 4),
        "terminal_meeting_date": terminal["meeting_date"],
        "terminal_expected_target_midpoint": round(float(terminal["expected_target_midpoint"]), 4),
        "terminal_most_likely_target": terminal["most_likely_target"],
        "peak_expected_target_midpoint": round(max(expected), 4),
        "trough_expected_target_midpoint": round(min(expected), 4),
        "first_majority_above_current": first_above["meeting_date"] if first_above else None,
        "first_majority_below_current": first_below["meeting_date"] if first_below else None,
    }


def main() -> None:
    now_kst = datetime.now(KST)
    now_et = now_kst.astimezone(ET)
    meetings = _load_full_fomc_meetings()
    upcoming = [d for d in meetings if d >= now_et.date()]
    if not upcoming:
        raise SystemExit("FEDWATCH_NO_UPCOMING_FOMC")

    effr, effr_date = core._fred_latest("EFFR")
    lower, lower_date = core._fred_latest("DFEDTARL")
    upper, upper_date = core._fred_latest("DFEDTARU")
    current_midpoint = (lower + upper) / 2.0

    expected_trade_date = core._expected_latest_trade_date(now_et)
    settlements, trade_date = core._fetch_latest_settlements(expected_trade_date)
    matrix, target_ranges, failures = _matrix_from_settlements(settlements, upcoming, meetings, lower, upper)
    if not matrix:
        raise SystemExit("FEDWATCH_MATRIX_EMPTY")

    prior_1d_settlements, prior_1d_date = _fetch_prior_available(core._prev_business_day(trade_date))
    prior_1w_settlements, prior_1w_date = _fetch_prior_available(core._business_day(trade_date - timedelta(days=7)))

    prior_1d_rows: list[dict] = []
    prior_1w_rows: list[dict] = []
    if prior_1d_settlements:
        prior_1d_rows, _, _ = _matrix_from_settlements(prior_1d_settlements, upcoming, meetings, lower, upper)
    if prior_1w_settlements:
        prior_1w_rows, _, _ = _matrix_from_settlements(prior_1w_settlements, upcoming, meetings, lower, upper)
    _attach_changes(matrix, prior_1d_rows, prior_1w_rows)

    first = matrix[0]
    outcomes = _legacy_outcomes(first, lower, upper)
    summary = _summary(outcomes)
    prior_day_first = prior_1d_rows[0] if prior_1d_rows else None
    prior_week_first = prior_1w_rows[0] if prior_1w_rows else None
    prior_day_summary = _summary(_legacy_outcomes(prior_day_first, lower, upper)) if prior_day_first else None
    prior_week_summary = _summary(_legacy_outcomes(prior_week_first, lower, upper)) if prior_week_first else None

    history = []
    if prior_1w_date and prior_week_first:
        history.append(_history_row(prior_1w_date, prior_week_first, lower, upper))
    if prior_1d_date and prior_day_first and prior_1d_date != prior_1w_date:
        history.append(_history_row(prior_1d_date, prior_day_first, lower, upper))
    history.append(_history_row(trade_date, first, lower, upper))
    history = sorted({x["trade_date"]: x for x in history}.values(), key=lambda x: x["trade_date"])

    business_lag = _business_gap(expected_trade_date, trade_date)
    if business_lag == 0:
        freshness = "LIVE"
    elif business_lag == 1:
        freshness = "LAGGING"
    else:
        freshness = "STALE"
    quality_state = "PASS" if freshness == "LIVE" else "DEGRADED"

    out = {
        "schema": "JJOONI_FED_WATCH_V1",
        "schema_revision": "2.0",
        "matrix_contract": "CME_FEDWATCH_CONDITIONAL_MEETING_PROBABILITY_MATRIX_V2",
        "generated_kst": now_kst.isoformat(timespec="seconds"),
        "read_only": True,
        "contains_account_data": False,
        "source": "CME Fed Funds futures settlement-derived FedWatch conditional meeting probability matrix",
        "source_priority": "CME_PRIMARY",
        "calculation_contract": "CME_FEDWATCH_ANCHOR_MONTH_PLUS_CONDITIONAL_CONVOLUTION_V2",
        "official_api_status": "NOT_CONFIGURED_SETTLEMENT_DERIVED",
        "meeting_date": first["meeting_date"],
        "market_data_as_of": trade_date.isoformat(),
        "expected_market_data_date": expected_trade_date.isoformat(),
        "observed_at": now_kst.isoformat(timespec="seconds"),
        "freshness": freshness,
        "freshness_reason": "CME settlement matches expected trade date" if freshness == "LIVE" else f"CME settlement lags expected date by {business_lag} business day(s)",
        "current_target": core._target_label(lower, upper),
        "current_target_lower": lower,
        "current_target_upper": upper,
        "effr": effr,
        "effr_date": effr_date,
        "outcomes": outcomes,
        **summary,
        "change_1d_pctpt": _delta_probability(summary, prior_day_summary, "hike_any_probability"),
        "change_1w_pctpt": _delta_probability(summary, prior_week_summary, "hike_any_probability"),
        "history": history,
        "target_ranges": target_ranges,
        "meeting_probability_matrix": matrix,
        "meeting_count": len(matrix),
        "path_summary": _path_summary(matrix, current_midpoint),
        "comparison_dates": {
            "current": trade_date.isoformat(),
            "prior_1d": prior_1d_date.isoformat() if prior_1d_date else None,
            "prior_1w": prior_1w_date.isoformat() if prior_1w_date else None,
        },
        "calculation": {
            "next_meeting_conditional_expected_change_bp": first["conditional_expected_change_bp"],
            "anchor_month": first["anchor_month"],
            "matrix_method": "Convolve each meeting's CME settlement-implied conditional 25bp move distribution into cumulative target-rate ranges.",
        },
        "quality": {
            "state": quality_state,
            "cme_trade_date_gap_business_days": business_lag,
            "fred_target_dates": {"lower": lower_date, "upper": upper_date, "effr": effr_date},
            "matrix_meetings": len(matrix),
            "matrix_failures": failures,
            "prior_1d_available": bool(prior_1d_rows),
            "prior_1w_available": bool(prior_1w_rows),
        },
        "provenance": {
            "cme_settlements": core.CME_SETTLEMENTS_URL,
            "cme_methodology": "https://www.cmegroup.com/articles/2023/understanding-the-cme-group-fedwatch-tool-methodology.html",
            "fred": core.FRED_CSV,
            "fomc_schedule": "Federal Reserve official schedule via economic-calendar.json plus embedded 2026-2027 official-date fallback",
        },
        "usage_contract": {
            "strategy_usable": freshness == "LIVE",
            "stale_rule": "Use the matrix as a strategy fact only when freshness=LIVE. LAGGING/STALE must be refreshed or independently verified.",
            "attribution": "CME FedWatch-compatible conditional meeting probabilities derived from CME 30-Day Fed Funds settlements; not the paid CME FedWatch API payload.",
        },
    }

    OUT.write_text(json.dumps(out, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print("FED_WATCH_MATRIX_V2_BUILD=PASS")
    print("market_data_as_of=", out["market_data_as_of"])
    print("expected_market_data_date=", out["expected_market_data_date"])
    print("freshness=", out["freshness"])
    print("meeting_count=", out["meeting_count"])
    print("target_ranges=", len(out["target_ranges"]))
    print("next_most_likely=", first["most_likely_target"], first["most_likely_probability"])
    if failures:
        print("matrix_failures=", failures)


if __name__ == "__main__":
    main()
