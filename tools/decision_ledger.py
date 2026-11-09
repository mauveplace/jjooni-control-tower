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
from datetime import datetime
from pathlib import Path, PurePosixPath

DECISION_ID = re.compile(r"^\d{4}-\d{2}-\d{2}-\d{2}$")
KST_TS = re.compile(r"^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2})?\+09:00$")
HORIZON = re.compile(r"^T\+\d{1,3}$|^next [A-Z-]+$")

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

REVIEW_REQUIRED = ("decision_id", "horizon", "asof_kst", "verdict", "executed", "note")
REVIEW_VERDICT = {"CORRECT", "INCORRECT", "MIXED", "NOT_EVALUABLE"}
REVIEW_ALLOWED = set(REVIEW_REQUIRED) | {"observed", "counterfactual", "lesson", "reviewer", "sources"}

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
    (re.compile(r"(?<![\d,.])(?!52\s*주)\d[\d,.]*\s*주(?=[\s,.)·/]|$)"), "share count (N주)"),
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
            if "observed_at_kst" in meta and not KST_TS.match(str(meta["observed_at_kst"])):
                errs.append(f"{where}: inputs_meta.observed_at_kst must be ISO-8601 with +09:00")
            if "verification" in meta and meta["verification"] not in VERIFICATION:
                errs.append(f"{where}: inputs_meta.verification must be one of {sorted(VERIFICATION)}")
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
    return errs + privacy_errors(rec, where)


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
    seen_reviews: dict[tuple[str, str], str] = {}
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
            key = (did, hz)
            if key in seen_reviews:
                errs.append(f"{where}: duplicate review for {did} {hz} (first at {seen_reviews[key]})")
            else:
                seen_reviews[key] = where
            t_dec, t_rev = _ts(dec.get("kst")), _ts(rec.get("asof_kst"))
            if t_dec and t_rev and t_rev <= t_dec:
                errs.append(f"{where}: asof_kst must be after the decision time {dec.get('kst')}")
            if isinstance(rec.get("executed"), bool) and rec["executed"] and dec.get("execution") != "EXECUTED":
                errs.append(f"{where}: executed=true but decision {did} execution is {dec.get('execution')}; append a superseding decision first")
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


def main(argv: list[str]) -> int:
    ap = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    ap.add_argument("root", nargs="?", default=None)
    ap.add_argument("--root", dest="root_opt", default=None)
    ap.add_argument("--base", default=None, help="git ref to enforce append-only against (e.g. origin/main)")
    a = ap.parse_args(argv[1:])
    repo = Path(__file__).resolve().parent.parent
    root = Path(a.root_opt or a.root or repo / "investment-decisions")
    errs = validate_tree(root)
    if a.base:
        errs += append_only_errors(repo, root, a.base)
    for e in errs:
        print(f"ERROR {e}")
    print(f"decision ledger: {'FAIL' if errs else 'PASS'} ({len(errs)} errors){' [append-only vs ' + a.base + ']' if a.base else ''}")
    return 1 if errs else 0


if __name__ == "__main__":
    sys.exit(main(sys.argv))
