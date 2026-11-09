#!/usr/bin/env python3
"""Validate the public JJOONI/ROY investment decision ledger.

Ledger layout (see investment-decisions/README.md):
  investment-decisions/<YYYY>/<MM>/daily-decisions.jsonl   one decision per line
  investment-decisions/<YYYY>/<MM>/outcome-reviews.jsonl   one outcome review per line

The ledger is PUBLIC and APPEND-ONLY. The validator fails closed on:
  * an empty or missing ledger,
  * schema errors and broken cross-references,
  * any field or phrase that looks like account, holding, quantity, cash or P&L data,
  * (with --base) any modification or deletion of a line that exists at the base ref.

It never reads Control Tower, never orders, and never changes strategy rules.

Usage:
  python tools/decision_ledger.py [--root DIR] [--base GIT_REF]
"""
from __future__ import annotations

import argparse
import json
import re
import subprocess
import sys
from datetime import date, datetime, time, timedelta
from zoneinfo import ZoneInfo
from pathlib import Path, PurePosixPath

DECISION_ID = re.compile(r"^\d{4}-\d{2}-\d{2}-\d{2}$")
KST_TS = re.compile(r"^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2})?\+09:00$")
HORIZON = re.compile(r"^T\+[1-9]\d{0,2}$|^next [A-Z-]+$")  # T+0 is not a horizon
T_N = re.compile(r"^T\+([1-9]\d{0,2})$")
DATE = re.compile(r"^\d{4}-\d{2}-\d{2}$")
PRIVATE_REF = re.compile(r"^PRIVATE_REF:[A-Za-z0-9_-]{4,64}$")
KST = ZoneInfo("Asia/Seoul")
MARKET_CLOSE = {"US": (ZoneInfo("America/New_York"), time(16, 0)), "KRX": (KST, time(15, 30))}

# Lifecycle of the idea itself. Owner approval and execution are SEPARATE fields.
DECISION_STATUS = {"ADOPTED", "RESEARCH", "REJECTED", "SUPERSEDED", "HOLD"}
CONSENSUS = {"AGREED", "PARTIAL", "DISAGREED", "SINGLE_AGENT"}
OWNER_DECISION = {"APPROVED", "REJECTED", "PENDING", "NOT_REQUIRED"}
EXECUTION = {"EXECUTED", "NOT_EXECUTED", "NOT_APPLICABLE"}
VERIFICATION = {"INDEPENDENTLY_VERIFIED", "SINGLE_SOURCE", "UNVERIFIED"}

DECISION_REQUIRED = ("decision_id", "kst", "topic", "final", "status", "consensus",
                     "owner_decision", "execution", "review_at")
DECISION_ALLOWED = set(DECISION_REQUIRED) | {
    "inputs", "inputs_meta", "jjooni", "roy", "dissent", "rationale", "supersedes",
    "sources", "source_issue",
}
INPUTS_META_REQUIRED = ("source", "observed_at_kst", "verification")
INPUTS_META_ALLOWED = set(INPUTS_META_REQUIRED) | {"fields", "note"}
FIELD_META_REQUIRED = ("source", "observed_at_kst")

REVIEW_REQUIRED = ("decision_id", "horizon", "asof_kst", "verdict", "executed", "outcome_basis", "note")
OUTCOME_BASIS = {"ACTUAL", "COUNTERFACTUAL"}
TN_REVIEW_REQUIRED = ("market", "matured_session_date", "calendar_basis")
# How the exact Nth session was established. Only the first two count toward confirmed scores.
#   AUTO_NYSE_RULES       US only: validator recomputes the Nth NYSE session from rule-based holidays.
#   DECLARED_WITH_SOURCE  author declares the holidays skipped, with source + checker; validator recomputes.
#   UNVERIFIED            weekday lower bound only; PROVISIONAL, excluded from confirmed scorecards.
CALENDAR_BASIS = {"AUTO_NYSE_RULES", "DECLARED_WITH_SOURCE", "UNVERIFIED"}
CONFIRMED_CALENDAR = {"AUTO_NYSE_RULES", "DECLARED_WITH_SOURCE"}
REVIEW_VERDICT = {"CORRECT", "INCORRECT", "MIXED", "NOT_EVALUABLE"}
REVIEW_ALLOWED = set(REVIEW_REQUIRED) | set(TN_REVIEW_REQUIRED) | {
    "observed", "counterfactual", "lesson", "reviewer", "sources", "execution_evidence", "calendar_evidence"}

# ---- public-ledger privacy guard -------------------------------------------------
FORBIDDEN_KEYS = {
    "qty", "quantity", "shares", "avg_price", "average_price", "cost_basis", "cash", "cash_krw",
    "cash_usd", "balance", "nav", "account", "account_id", "pnl", "pnl_krw", "krw_amount",
    "market_value", "holdings", "positions", "order_id", "broker", "amount", "amount_krw",
}
FORBIDDEN_PHRASES = (
    "평단", "보유수량", "보유 수량", "예수금", "잔고", "계좌번호", "평가손익", "평가액", "매입금액",
    "주문번호", "체결가", "체결 수량", "내 계좌", "형님 계좌",
)
# Free-text numeric patterns typical of personal position data.
FORBIDDEN_PATTERNS = (
    (re.compile(r"(?<![\d,.])(?!52\s*주\s*(?:고점|저점|최고|최저|신고|신저|고가|저가|낙폭|범위|high|low))\d[\d,.]*\s*주(?=[\s,.)·/]|$)"),
     "share count (N주)"),
    (re.compile(r"\d[\d,.]*\s*(만\s*원|억\s*원|만원|억원|천만|백만)"), "KRW amount (만원/억원)"),
    (re.compile(r"₩\s*\d"), "KRW amount (₩)"),
    (re.compile(r"\d[\d,.]*\s*shares?\b", re.I), "share count (shares)"),
)


def _walk(obj, path=""):
    if isinstance(obj, dict):
        for k, v in obj.items():
            yield f"{path}{k}", k, v
            yield from _walk(v, f"{path}{k}.")
    elif isinstance(obj, list):
        for i, v in enumerate(obj):
            yield from _walk(v, f"{path}{i}.")


def privacy_errors(record: dict, where: str) -> list[str]:
    errs = []
    for full, key, value in _walk(record):
        if key.lower() in FORBIDDEN_KEYS:
            errs.append(f"{where}: forbidden private key '{full}'")
        if isinstance(value, str):
            for pattern, label in FORBIDDEN_PATTERNS:
                if pattern.search(value):
                    errs.append(f"{where}: possible private {label} in '{full}'")
    text = json.dumps(record, ensure_ascii=False)
    for phrase in FORBIDDEN_PHRASES:
        if phrase in text:
            errs.append(f"{where}: forbidden private phrase '{phrase}'")
    return errs


def _ts(s: str) -> datetime | None:
    try:
        return datetime.fromisoformat(s)
    except (TypeError, ValueError):
        return None


def _provenance_errors(meta: dict, decision_kst, label: str) -> list[str]:
    """Inputs must be non-empty-sourced and observable at or before the decision time (no look-ahead)."""
    errs = []
    if "source" in meta and (not isinstance(meta["source"], str) or not meta["source"].strip()):
        errs.append(f"{label}.source must be a non-empty string")
    if "observed_at_kst" in meta:
        if not KST_TS.match(str(meta["observed_at_kst"])):
            errs.append(f"{label}.observed_at_kst must be ISO-8601 with +09:00")
        else:
            t_obs, t_dec = _ts(meta["observed_at_kst"]), _ts(decision_kst)
            if t_obs and t_dec and t_obs > t_dec:
                errs.append(f"{label}.observed_at_kst {meta['observed_at_kst']} is after the decision time {decision_kst} "
                            "(look-ahead); record later data in an outcome review or a superseding decision")
    return errs


def _date(s) -> date | None:
    if not isinstance(s, str) or not DATE.match(s):
        return None
    try:
        return date.fromisoformat(s)
    except ValueError:
        return None


def _easter(y: int) -> date:
    a, b, c = y % 19, y // 100, y % 100
    d, e = b // 4, b % 4
    f = (b + 8) // 25
    g = (b - f + 1) // 3
    h = (19 * a + b - d - g + 15) % 30
    i, k = c // 4, c % 4
    l = (32 + 2 * e + 2 * i - h - k) % 7
    m = (a + 11 * h + 22 * l) // 451
    month = (h + l - 7 * m + 114) // 31
    return date(y, month, (h + l - 7 * m + 114) % 31 + 1)


def _nth_weekday(y: int, month: int, weekday: int, n: int) -> date:
    d = date(y, month, 1)
    d += timedelta(days=(weekday - d.weekday()) % 7)
    return d + timedelta(weeks=n - 1)


def _last_weekday(y: int, month: int, weekday: int) -> date:
    d = date(y + (month == 12), month % 12 + 1, 1) - timedelta(days=1)
    return d - timedelta(days=(d.weekday() - weekday) % 7)


def nyse_holidays(y: int) -> set[date]:
    """Rule-based NYSE full-day closures. Unscheduled closures (e.g. national mourning) are not
    predictable and must be declared via calendar_evidence.extra_closures."""
    def observed(d: date) -> date | None:
        if d.weekday() == 5:
            return d - timedelta(days=1)
        if d.weekday() == 6:
            return d + timedelta(days=1)
        return d
    out = {
        _nth_weekday(y, 1, 0, 3),            # MLK Day
        _nth_weekday(y, 2, 0, 3),            # Presidents Day
        _easter(y) - timedelta(days=2),      # Good Friday
        _last_weekday(y, 5, 0),              # Memorial Day
        observed(date(y, 7, 4)),             # Independence Day
        _nth_weekday(y, 9, 0, 1),            # Labor Day
        _nth_weekday(y, 11, 3, 4),           # Thanksgiving
        observed(date(y, 12, 25)),           # Christmas
    }
    ny = date(y, 1, 1)
    if ny.weekday() != 5:                    # NYSE does not close Fri Dec 31 for a Saturday New Year
        out.add(observed(ny))
    if y >= 2022:
        out.add(observed(date(y, 6, 19)))    # Juneteenth
    return out


def nth_session(market: str, decision_kst: datetime, n: int, skip: set[date]) -> date:
    """Nth regular session (weekday, not in `skip`) whose close is after the decision time."""
    d = decision_kst.astimezone(MARKET_CLOSE[market][0]).date()
    count = 0
    while True:
        if d.weekday() < 5 and d not in skip and session_close_kst(market, d) > decision_kst:
            count += 1
            if count == n:
                return d
        d += timedelta(days=1)


def session_close_kst(market: str, d: date) -> datetime:
    tz, close = MARKET_CLOSE[market]
    return datetime.combine(d, close, tzinfo=tz).astimezone(KST)


def nth_weekday_session(market: str, decision_kst: datetime, n: int) -> date:
    """Weekday-only lower bound for the Nth session (holidays can only push the true date later)."""
    return nth_session(market, decision_kst, n, set())


def validate_decision(rec: dict, where: str) -> list[str]:
    errs = [f"{where}: missing '{k}'" for k in DECISION_REQUIRED if k not in rec]
    errs += [f"{where}: unknown field '{k}'" for k in rec if k not in DECISION_ALLOWED]
    if "decision_id" in rec and not DECISION_ID.match(str(rec["decision_id"])):
        errs.append(f"{where}: decision_id must be YYYY-MM-DD-NN")
    if "kst" in rec and not KST_TS.match(str(rec["kst"])):
        errs.append(f"{where}: kst must be ISO-8601 with +09:00")
    if "decision_id" in rec and "kst" in rec and not str(rec["kst"]).startswith(str(rec["decision_id"])[:10]):
        errs.append(f"{where}: decision_id date must match kst date")
    for field, allowed in (("status", DECISION_STATUS), ("consensus", CONSENSUS),
                           ("owner_decision", OWNER_DECISION), ("execution", EXECUTION)):
        if field in rec and rec[field] not in allowed:
            errs.append(f"{where}: {field} must be one of {sorted(allowed)}")
    if rec.get("execution") == "EXECUTED" and rec.get("owner_decision") != "APPROVED":
        errs.append(f"{where}: execution=EXECUTED requires owner_decision=APPROVED")
    if "review_at" in rec and (not isinstance(rec["review_at"], list) or not rec["review_at"]
                               or len(set(rec["review_at"])) != len(rec["review_at"])
                               or not all(isinstance(h, str) and HORIZON.match(h) for h in rec["review_at"])):
        errs.append(f"{where}: review_at must be a non-empty, duplicate-free list like ['T+1','T+5'] or ['next NO-POD']")
    if "inputs" in rec:
        meta = rec.get("inputs_meta")
        if not isinstance(meta, dict):
            errs.append(f"{where}: 'inputs' requires 'inputs_meta' with {list(INPUTS_META_REQUIRED)}")
        else:
            errs += [f"{where}: inputs_meta missing '{k}'" for k in INPUTS_META_REQUIRED if k not in meta]
            errs += [f"{where}: inputs_meta unknown field '{k}'" for k in meta if k not in INPUTS_META_ALLOWED]
            if "verification" in meta and meta["verification"] not in VERIFICATION:
                errs.append(f"{where}: inputs_meta.verification must be one of {sorted(VERIFICATION)}")
            errs += _provenance_errors(meta, rec.get("kst"), f"{where}: inputs_meta")
            fields = meta.get("fields")
            if fields is not None:
                inputs = rec.get("inputs") if isinstance(rec.get("inputs"), dict) else {}
                if not isinstance(fields, dict):
                    errs.append(f"{where}: inputs_meta.fields must map input keys to provenance")
                else:
                    for k, fm in fields.items():
                        if k not in inputs:
                            errs.append(f"{where}: inputs_meta.fields.{k} has no matching inputs key")
                        if not isinstance(fm, dict):
                            errs.append(f"{where}: inputs_meta.fields.{k} must be an object")
                            continue
                        errs += [f"{where}: inputs_meta.fields.{k} missing '{x}'" for x in FIELD_META_REQUIRED if x not in fm]
                        errs += _provenance_errors(fm, rec.get("kst"), f"{where}: inputs_meta.fields.{k}")
    return errs + privacy_errors(rec, where)


def validate_review(rec: dict, where: str) -> list[str]:
    errs = [f"{where}: missing '{k}'" for k in REVIEW_REQUIRED if k not in rec]
    errs += [f"{where}: unknown field '{k}'" for k in rec if k not in REVIEW_ALLOWED]
    if "horizon" in rec and not HORIZON.match(str(rec["horizon"])):
        errs.append(f"{where}: horizon must look like T+5 or 'next NO-POD'")
    if "asof_kst" in rec and not KST_TS.match(str(rec["asof_kst"])):
        errs.append(f"{where}: asof_kst must be ISO-8601 with +09:00")
    if "verdict" in rec and rec["verdict"] not in REVIEW_VERDICT:
        errs.append(f"{where}: verdict must be one of {sorted(REVIEW_VERDICT)}")
    if "executed" in rec and not isinstance(rec["executed"], bool):
        errs.append(f"{where}: executed must be boolean (keeps hypothetical and realized outcomes separate)")
    basis = rec.get("outcome_basis")
    if "outcome_basis" in rec and basis not in OUTCOME_BASIS:
        errs.append(f"{where}: outcome_basis must be one of {sorted(OUTCOME_BASIS)}")
    if basis == "ACTUAL":
        if rec.get("executed") is not True:
            errs.append(f"{where}: outcome_basis=ACTUAL requires executed=true")
        if not PRIVATE_REF.match(str(rec.get("execution_evidence", ""))):
            errs.append(f"{where}: outcome_basis=ACTUAL requires execution_evidence 'PRIVATE_REF:<opaque id>' (never raw trade data)")
    if basis == "COUNTERFACTUAL":
        if rec.get("executed") is not False:
            errs.append(f"{where}: outcome_basis=COUNTERFACTUAL requires executed=false")
        if "execution_evidence" in rec:
            errs.append(f"{where}: COUNTERFACTUAL reviews must not carry execution_evidence")
    if T_N.match(str(rec.get("horizon", ""))):
        errs += [f"{where}: T+N review missing '{k}'" for k in TN_REVIEW_REQUIRED if k not in rec]
        if "market" in rec and rec["market"] not in MARKET_CLOSE:
            errs.append(f"{where}: market must be one of {sorted(MARKET_CLOSE)}")
        if "matured_session_date" in rec and _date(rec["matured_session_date"]) is None:
            errs.append(f"{where}: matured_session_date must be a valid calendar date YYYY-MM-DD")
        cb = rec.get("calendar_basis")
        if "calendar_basis" in rec and cb not in CALENDAR_BASIS:
            errs.append(f"{where}: calendar_basis must be one of {sorted(CALENDAR_BASIS)}")
        if cb == "AUTO_NYSE_RULES" and rec.get("market") != "US":
            errs.append(f"{where}: calendar_basis=AUTO_NYSE_RULES is only valid for market=US")
        ev = rec.get("calendar_evidence")
        if cb == "DECLARED_WITH_SOURCE":
            if not isinstance(ev, dict):
                errs.append(f"{where}: DECLARED_WITH_SOURCE requires calendar_evidence {{source, checked_by, holidays_skipped}}")
            else:
                for k in ("source", "checked_by"):
                    if not isinstance(ev.get(k), str) or not ev.get(k, "").strip():
                        errs.append(f"{where}: calendar_evidence.{k} must be a non-empty string")
                if not isinstance(ev.get("holidays_skipped"), list):
                    errs.append(f"{where}: calendar_evidence.holidays_skipped must be a list (empty if none)")
        if ev is not None and isinstance(ev, dict):
            for k in ("holidays_skipped", "extra_closures"):
                for x in ev.get(k, []) if isinstance(ev.get(k), list) else []:
                    if _date(x) is None:
                        errs.append(f"{where}: calendar_evidence.{k} has invalid date {x!r}")
            if ev.get("extra_closures") and not (isinstance(ev.get("source"), str) and ev["source"].strip()):
                errs.append(f"{where}: calendar_evidence.extra_closures requires a non-empty source")
        if cb == "UNVERIFIED" and ev is not None:
            errs.append(f"{where}: calendar_basis=UNVERIFIED must not carry calendar_evidence")
    return errs + privacy_errors(rec, where)


def maturity_errors(rec: dict, dec: dict, where: str) -> list[str]:
    """For T+N: the matured session must be at least the Nth weekday session after the decision,
    and the review must be written after that session's close."""
    m = T_N.match(str(rec.get("horizon", "")))
    session = _date(rec.get("matured_session_date"))
    if not m or rec.get("market") not in MARKET_CLOSE or session is None:
        return []
    t_dec, t_rev = _ts(dec.get("kst")), _ts(rec.get("asof_kst"))
    if not t_dec or not t_rev:
        return []
    n, market, cb = int(m.group(1)), rec["market"], rec.get("calendar_basis")
    errs = []
    earliest = nth_weekday_session(market, t_dec, n)
    if session < earliest:
        errs.append(f"{where}: {rec['horizon']} cannot mature on {session} ({market}); earliest possible session is {earliest}")
    ev = rec.get("calendar_evidence") if isinstance(rec.get("calendar_evidence"), dict) else {}
    extra = {d for d in (_date(x) for x in ev.get("extra_closures", []) or []) if d}
    skip = None
    if cb == "AUTO_NYSE_RULES" and market == "US":
        skip = set().union(*(nyse_holidays(y) for y in range(t_dec.year, t_dec.year + 2))) | extra
    elif cb == "DECLARED_WITH_SOURCE" and isinstance(ev.get("holidays_skipped"), list):
        skip = {d for d in (_date(x) for x in ev["holidays_skipped"]) if d} | extra
    if skip is not None:
        exact = nth_session(market, t_dec, n, skip)
        if session != exact:
            errs.append(f"{where}: {rec['horizon']} ({market}, {cb}) is {exact}, not {session}")
    if session.weekday() >= 5:
        errs.append(f"{where}: matured_session_date {session} is a weekend")
    close = session_close_kst(market, session)
    if t_rev < close:
        errs.append(f"{where}: asof_kst {rec['asof_kst']} is before the {market} close of {session} ({close.isoformat()})")
    return errs


def _parse_lines(text: str, label: str) -> tuple[list[tuple[int, dict]], list[str]]:
    rows, errs = [], []
    for n, line in enumerate(text.splitlines(), 1):
        if not line.strip():
            continue
        try:
            obj = json.loads(line)
        except json.JSONDecodeError as e:
            errs.append(f"{label}:{n}: invalid JSON ({e.msg})")
            continue
        if not isinstance(obj, dict):
            errs.append(f"{label}:{n}: each line must be a JSON object")
            continue
        rows.append((n, obj))
    return rows, errs


def validate_tree(root: Path) -> list[str]:
    errs: list[str] = []
    decision_files = sorted(root.glob("*/*/daily-decisions.jsonl"))
    if not decision_files:
        return [f"{root}: no daily-decisions.jsonl found; an empty ledger is never a PASS"]
    decisions: dict[str, dict] = {}
    where_of: dict[str, str] = {}
    supersedes: list[tuple[str, str]] = []
    total = 0
    for f in decision_files:
        rows, e = _parse_lines(f.read_text(encoding="utf-8"), str(f))
        errs += e
        for n, rec in rows:
            total += 1
            where = f"{f}:{n}"
            errs += validate_decision(rec, where)
            did = rec.get("decision_id")
            if did:
                ym = f"{f.parent.parent.name}-{f.parent.name}"
                if not str(did).startswith(ym):
                    errs.append(f"{where}: decision_id {did} filed under wrong month folder {ym}")
                if did in decisions:
                    errs.append(f"{where}: duplicate decision_id {did} (first at {where_of[did]}); append a new id with 'supersedes' instead")
                else:
                    decisions[did], where_of[did] = rec, where
            if rec.get("supersedes"):
                supersedes.append((where, rec["supersedes"]))
    if total == 0:
        errs.append(f"{root}: ledger contains zero decisions; an empty ledger is never a PASS")
    for where, target in supersedes:
        if target not in decisions:
            errs.append(f"{where}: supersedes unknown decision_id {target}")
    seen_reviews: dict[tuple, str] = {}
    for f in sorted(root.glob("*/*/outcome-reviews.jsonl")):
        rows, e = _parse_lines(f.read_text(encoding="utf-8"), str(f))
        errs += e
        for n, rec in rows:
            where = f"{f}:{n}"
            errs += validate_review(rec, where)
            did, hz = rec.get("decision_id"), rec.get("horizon")
            dec = decisions.get(did)
            if did and dec is None:
                errs.append(f"{where}: review references unknown decision_id {did}")
                continue
            if dec is None:
                continue
            if hz and isinstance(dec.get("review_at"), list) and hz not in dec["review_at"]:
                errs.append(f"{where}: horizon {hz} is not in decision {did} review_at {dec['review_at']}")
            key = (did, hz, rec.get("outcome_basis"))
            if key in seen_reviews:
                errs.append(f"{where}: duplicate {key[2]} review for {did} {hz} (first at {seen_reviews[key]})")
            else:
                seen_reviews[key] = where
            t_dec, t_rev = _ts(dec.get("kst")), _ts(rec.get("asof_kst"))
            if t_dec and t_rev and t_rev <= t_dec:
                errs.append(f"{where}: asof_kst must be after the decision time {dec.get('kst')}")
            if rec.get("outcome_basis") == "ACTUAL" and dec.get("execution") != "EXECUTED":
                errs.append(f"{where}: ACTUAL outcome but decision {did} execution is {dec.get('execution')}; append a superseding decision first")
            errs += maturity_errors(rec, dec, where)
    errs += markdown_privacy_errors(root)
    return errs


def markdown_privacy_errors(root: Path) -> list[str]:
    """Scorecards and docs are public too: apply phrase and free-text pattern checks to every .md file."""
    errs = []
    for f in sorted(root.rglob("*.md")):
        for n, line in enumerate(f.read_text(encoding="utf-8").splitlines(), 1):
            for phrase in FORBIDDEN_PHRASES:
                if phrase in line:
                    errs.append(f"{f}:{n}: forbidden private phrase '{phrase}'")
            for pattern, label in FORBIDDEN_PATTERNS:
                if pattern.search(line):
                    errs.append(f"{f}:{n}: possible private {label}")
    return errs


# ---- append-only check against a git base ref --------------------------------------
def _git(repo: Path, *args: str) -> str:
    return subprocess.run(["git", "-C", str(repo), *args], check=True, capture_output=True, text=True).stdout


def append_only_errors(repo: Path, root: Path, base: str) -> list[str]:
    """Every ledger line present at `base` must still exist, unchanged and in order, as a prefix at HEAD."""
    rel = PurePosixPath(root.resolve().relative_to(repo.resolve()).as_posix())
    try:
        listed = _git(repo, "ls-tree", "-r", "--name-only", base, "--", str(rel))
    except subprocess.CalledProcessError as e:
        return [f"append-only: cannot read base ref '{base}' ({e.stderr.strip()[:200]})"]
    errs = []
    for path in listed.splitlines():
        if not path.endswith(".jsonl"):
            continue
        base_lines = [l for l in _git(repo, "show", f"{base}:{path}").splitlines() if l.strip()]
        head_file = repo / path
        if not head_file.exists():
            if base_lines:
                errs.append(f"append-only: {path} was deleted ({len(base_lines)} existing lines)")
            continue
        head_lines = [l for l in head_file.read_text(encoding="utf-8").splitlines() if l.strip()]
        for i, old in enumerate(base_lines):
            if i >= len(head_lines):
                errs.append(f"append-only: {path} line {i + 1} was removed")
                break
            same = (json.loads(old) == json.loads(head_lines[i])) if _is_json(old) and _is_json(head_lines[i]) else old == head_lines[i]
            if not same:
                errs.append(f"append-only: {path} line {i + 1} was modified; append a superseding record instead")
    return errs


def _is_json(s: str) -> bool:
    try:
        json.loads(s)
        return True
    except json.JSONDecodeError:
        return False


def scorecard(root: Path) -> dict:
    """Aggregate outcome reviews. ACTUAL and COUNTERFACTUAL are never mixed.
    A review counts as CONFIRMED only if its horizon is event-based or its calendar_basis is verified;
    UNVERIFIED-calendar reviews are reported separately as PROVISIONAL."""
    out = {b: {"confirmed": {v: 0 for v in sorted(REVIEW_VERDICT)}, "provisional": {v: 0 for v in sorted(REVIEW_VERDICT)}}
           for b in sorted(OUTCOME_BASIS)}
    for f in sorted(root.glob("*/*/outcome-reviews.jsonl")):
        rows, _ = _parse_lines(f.read_text(encoding="utf-8"), str(f))
        for _, rec in rows:
            b, v = rec.get("outcome_basis"), rec.get("verdict")
            if b not in OUTCOME_BASIS or v not in REVIEW_VERDICT:
                continue
            confirmed = not T_N.match(str(rec.get("horizon", ""))) or rec.get("calendar_basis") in CONFIRMED_CALENDAR
            out[b]["confirmed" if confirmed else "provisional"][v] += 1
    return out


def main(argv: list[str]) -> int:
    ap = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    ap.add_argument("root", nargs="?", default=None)
    ap.add_argument("--root", dest="root_opt", default=None)
    ap.add_argument("--base", default=None, help="git ref to enforce append-only against (e.g. origin/main)")
    ap.add_argument("--scorecard", action="store_true", help="print confirmed/provisional counts per outcome basis")
    a = ap.parse_args(argv[1:])
    repo = Path(__file__).resolve().parent.parent
    root = Path(a.root_opt or a.root or repo / "investment-decisions")
    errs = validate_tree(root)
    if a.base:
        errs += append_only_errors(repo, root, a.base)
    for e in errs:
        print(f"ERROR {e}")
    if a.scorecard and not errs:
        print(json.dumps(scorecard(root), ensure_ascii=False, indent=2))
    print(f"decision ledger: {'FAIL' if errs else 'PASS'} ({len(errs)} errors){' [append-only vs ' + a.base + ']' if a.base else ''}")
    return 1 if errs else 0


if __name__ == "__main__":
    sys.exit(main(sys.argv))
