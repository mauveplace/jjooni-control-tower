#!/usr/bin/env python3
"""Validate the public JJOONI/ROY investment decision ledger.

Ledger layout (see investment-decisions/README.md):
  investment-decisions/<YYYY>/<MM>/daily-decisions.jsonl   one decision per line
  investment-decisions/<YYYY>/<MM>/outcome-reviews.jsonl   one outcome review per line

The ledger is PUBLIC. The validator fails closed on any field or phrase that
looks like account, holding, quantity, cash or P&L data. It never reads
Control Tower, never orders, and never changes strategy rules.

Usage: python tools/decision_ledger.py [ledger_root]
"""
from __future__ import annotations

import json
import re
import sys
from pathlib import Path

DECISION_ID = re.compile(r"^\d{4}-\d{2}-\d{2}-\d{2}$")
KST_TS = re.compile(r"^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2})?\+09:00$")

DECISION_REQUIRED = ("decision_id", "kst", "topic", "final", "status", "review_at")
DECISION_STATUS = {"ADOPTED", "RESEARCH", "REJECTED", "SUPERSEDED", "HOLD"}
DECISION_ALLOWED = set(DECISION_REQUIRED) | {
    "inputs", "jjooni", "roy", "dissent", "rationale", "supersedes", "sources", "source_issue",
}

REVIEW_REQUIRED = ("decision_id", "horizon", "asof_kst", "verdict", "executed", "note")
REVIEW_VERDICT = {"CORRECT", "INCORRECT", "MIXED", "NOT_EVALUABLE"}
REVIEW_HORIZON = re.compile(r"^T\+\d{1,3}$|^next [A-Z-]+$")
REVIEW_ALLOWED = set(REVIEW_REQUIRED) | {"observed", "counterfactual", "lesson", "reviewer"}

# Public-ledger privacy guard: keys and phrases that indicate personal account data.
FORBIDDEN_KEYS = {
    "qty", "quantity", "shares", "avg_price", "average_price", "cost_basis", "cash", "cash_krw",
    "cash_usd", "balance", "nav", "account", "account_id", "pnl", "pnl_krw", "krw_amount",
    "market_value", "holdings", "positions", "order_id", "broker",
}
FORBIDDEN_PHRASES = (
    "평단", "보유수량", "보유 수량", "예수금", "잔고", "계좌번호", "평가손익", "평가액", "매입금액", "주문번호",
)


def _walk_keys(obj, path=""):
    if isinstance(obj, dict):
        for k, v in obj.items():
            yield f"{path}{k}", k
            yield from _walk_keys(v, f"{path}{k}.")
    elif isinstance(obj, list):
        for i, v in enumerate(obj):
            yield from _walk_keys(v, f"{path}{i}.")


def privacy_errors(record: dict, where: str) -> list[str]:
    errs = []
    for full, key in _walk_keys(record):
        if key.lower() in FORBIDDEN_KEYS:
            errs.append(f"{where}: forbidden private key '{full}'")
    text = json.dumps(record, ensure_ascii=False)
    for phrase in FORBIDDEN_PHRASES:
        if phrase in text:
            errs.append(f"{where}: forbidden private phrase '{phrase}'")
    return errs


def validate_decision(rec: dict, where: str) -> list[str]:
    errs = [f"{where}: missing '{k}'" for k in DECISION_REQUIRED if k not in rec]
    errs += [f"{where}: unknown field '{k}'" for k in rec if k not in DECISION_ALLOWED]
    if "decision_id" in rec and not DECISION_ID.match(str(rec["decision_id"])):
        errs.append(f"{where}: decision_id must be YYYY-MM-DD-NN")
    if "kst" in rec and not KST_TS.match(str(rec["kst"])):
        errs.append(f"{where}: kst must be ISO-8601 with +09:00")
    if "decision_id" in rec and "kst" in rec and not str(rec["kst"]).startswith(str(rec["decision_id"])[:10]):
        errs.append(f"{where}: decision_id date must match kst date")
    if "status" in rec and rec["status"] not in DECISION_STATUS:
        errs.append(f"{where}: status must be one of {sorted(DECISION_STATUS)}")
    if "review_at" in rec and (not isinstance(rec["review_at"], list) or not rec["review_at"]
                               or not all(isinstance(h, str) and REVIEW_HORIZON.match(h) for h in rec["review_at"])):
        errs.append(f"{where}: review_at must be a non-empty list like ['T+1','T+5'] or ['next NO-POD']")
    if rec.get("status") == "SUPERSEDED" or "supersedes" in rec:
        pass  # cross-record checks happen in validate_tree
    return errs + privacy_errors(rec, where)


def validate_review(rec: dict, where: str) -> list[str]:
    errs = [f"{where}: missing '{k}'" for k in REVIEW_REQUIRED if k not in rec]
    errs += [f"{where}: unknown field '{k}'" for k in rec if k not in REVIEW_ALLOWED]
    if "horizon" in rec and not REVIEW_HORIZON.match(str(rec["horizon"])):
        errs.append(f"{where}: horizon must look like T+5")
    if "asof_kst" in rec and not KST_TS.match(str(rec["asof_kst"])):
        errs.append(f"{where}: asof_kst must be ISO-8601 with +09:00")
    if "verdict" in rec and rec["verdict"] not in REVIEW_VERDICT:
        errs.append(f"{where}: verdict must be one of {sorted(REVIEW_VERDICT)}")
    if "executed" in rec and not isinstance(rec["executed"], bool):
        errs.append(f"{where}: executed must be boolean (keeps hypothetical and real outcomes separate)")
    return errs + privacy_errors(rec, where)


def _read_jsonl(path: Path) -> tuple[list[tuple[int, dict]], list[str]]:
    rows, errs = [], []
    for n, line in enumerate(path.read_text(encoding="utf-8").splitlines(), 1):
        if not line.strip():
            continue
        try:
            obj = json.loads(line)
        except json.JSONDecodeError as e:
            errs.append(f"{path}:{n}: invalid JSON ({e.msg})")
            continue
        if not isinstance(obj, dict):
            errs.append(f"{path}:{n}: each line must be a JSON object")
            continue
        rows.append((n, obj))
    return rows, errs


def validate_tree(root: Path) -> list[str]:
    errs: list[str] = []
    decisions: dict[str, str] = {}
    supersedes: list[tuple[str, str]] = []
    for f in sorted(root.glob("*/*/daily-decisions.jsonl")):
        rows, e = _read_jsonl(f)
        errs += e
        for n, rec in rows:
            where = f"{f}:{n}"
            errs += validate_decision(rec, where)
            did = rec.get("decision_id")
            if did:
                ym = f"{f.parent.parent.name}-{f.parent.name}"
                if not str(did).startswith(ym):
                    errs.append(f"{where}: decision_id {did} filed under wrong month folder {ym}")
                if did in decisions:
                    errs.append(f"{where}: duplicate decision_id {did} (first at {decisions[did]}); append a new id with 'supersedes' instead")
                decisions[did] = where
            if rec.get("supersedes"):
                supersedes.append((where, rec["supersedes"]))
    for where, target in supersedes:
        if target not in decisions:
            errs.append(f"{where}: supersedes unknown decision_id {target}")
    for f in sorted(root.glob("*/*/outcome-reviews.jsonl")):
        rows, e = _read_jsonl(f)
        errs += e
        for n, rec in rows:
            where = f"{f}:{n}"
            errs += validate_review(rec, where)
            if rec.get("decision_id") and rec["decision_id"] not in decisions:
                errs.append(f"{where}: review references unknown decision_id {rec['decision_id']}")
    return errs


def main(argv: list[str]) -> int:
    root = Path(argv[1]) if len(argv) > 1 else Path(__file__).resolve().parent.parent / "investment-decisions"
    errs = validate_tree(root)
    for e in errs:
        print(f"ERROR {e}")
    print(f"decision ledger: {'FAIL' if errs else 'PASS'} ({len(errs)} errors)")
    return 1 if errs else 0


if __name__ == "__main__":
    sys.exit(main(sys.argv))
