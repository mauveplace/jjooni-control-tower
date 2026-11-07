#!/usr/bin/env python3
"""API-free offline relay for a three-agent review. Never invokes models/orders."""
import argparse
import json
from pathlib import Path

ROLES = ("JJOONI", "ROY", "JJANGGU")
PHASES = {"proposal": "JJOONI", "risk_review": "ROY", "data_review": "JJANGGU", "synthesis": "JJOONI"}
MAX_BODY = 1200

def load(path):
    doc = json.loads(Path(path).read_text(encoding="utf-8"))
    assert isinstance(doc, dict) and doc.get("task_id") and isinstance(doc.get("messages"), list)
    for msg in doc["messages"]:
        assert all(k in msg for k in ("id", "role", "phase", "body", "ref"))
    return doc

def status(doc):
    by_phase = {m["phase"]: m for m in doc["messages"]}
    if "proposal" not in by_phase:
        return "AWAITING_JJOONI_PROPOSAL"
    if "risk_review" not in by_phase or "data_review" not in by_phase:
        missing = [PHASES[p] for p in ("risk_review", "data_review") if p not in by_phase]
        return "AWAITING_" + "_AND_".join(missing)
    if "synthesis" not in by_phase:
        return "AWAITING_JJOONI_SYNTHESIS"
    return "REVIEW_COMPLETE_NOT_ORDER_APPROVED"

def add(doc, role, phase, body, ref):
    if phase not in PHASES or PHASES[phase] != role:
        raise ValueError("Role/phase mismatch")
    if not body.strip() or len(body) > MAX_BODY:
        raise ValueError("Message must be 1–1200 characters")
    if not ref.strip() or len(ref) > 180:
        raise ValueError("Provide a short, verifiable reference or UNKNOWN")
    if any(m["phase"] == phase for m in doc["messages"]):
        raise ValueError("Duplicate phase; use a new task for another review cycle")
    existing = {m["phase"] for m in doc["messages"]}
    if phase != "proposal" and "proposal" not in existing:
        raise ValueError("Proposal must precede other phases")
    if phase == "synthesis" and not {"risk_review", "data_review"} <= existing:
        raise ValueError("Both reviews must precede synthesis")
    doc["messages"].append({"id": f"{doc['task_id']}:{phase}", "role": role,
                            "phase": phase, "body": body.strip(), "ref": ref.strip()})
    return doc

def handoff(doc):
    """Minimal handoff; do not dump full spreadsheet or conversation history."""
    return {"task_id": doc["task_id"], "status": status(doc),
            "items": [{"phase": m["phase"], "role": m["role"], "body": m["body"], "ref": m["ref"]}
                      for m in doc["messages"]]}

def main():
    parser = argparse.ArgumentParser(description="Offline relay; no API/model calls")
    parser.add_argument("action", choices=("status", "handoff", "add"))
    parser.add_argument("task", type=Path)
    parser.add_argument("--role", choices=ROLES)
    parser.add_argument("--phase", choices=tuple(PHASES))
    parser.add_argument("--body")
    parser.add_argument("--ref")
    args = parser.parse_args()
    doc = load(args.task)
    if args.action == "add":
        if not all((args.role, args.phase, args.body, args.ref)):
            parser.error("add requires --role --phase --body --ref")
        add(doc, args.role, args.phase, args.body, args.ref)
        args.task.write_text(json.dumps(doc, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    elif args.action == "handoff":
        print(json.dumps(handoff(doc), ensure_ascii=False, separators=(",", ":")))
    print(status(doc))

if __name__ == "__main__":
    main()
