#!/usr/bin/env python3
"""Offline review-message validator for a three-agent pilot; no model/API/broker calls."""
import argparse
import json
import os
from pathlib import Path
import re
import tempfile

ROLES = ("JJOONI", "ROY", "JJANGGU")
PHASES = {"proposal": "JJOONI", "risk_review": "ROY", "data_review": "JJANGGU", "synthesis": "JJOONI"}
MAX_BODY = 1200
MAX_REF = 180
MAX_MESSAGES = len(PHASES)
TASK_RE = re.compile(r"^[A-Za-z0-9._:-]{1,128}$")


def validate(doc):
    """Validate manually edited files too; never rely on Python assert."""
    if not isinstance(doc, dict) or not isinstance(doc.get("task_id"), str) or not TASK_RE.fullmatch(doc["task_id"]):
        raise ValueError("Invalid task_id")
    messages = doc.get("messages")
    if not isinstance(messages, list) or len(messages) > MAX_MESSAGES:
        raise ValueError("Invalid messages array")
    seen = set()
    for index, msg in enumerate(messages):
        if not isinstance(msg, dict) or not all(isinstance(msg.get(key), str) for key in ("id", "role", "phase", "body", "ref")):
            raise ValueError(f"Invalid message shape at index {index}")
        phase = msg["phase"]
        if phase not in PHASES or PHASES[phase] != msg["role"]:
            raise ValueError(f"Invalid role/phase at index {index}")
        if msg["id"] != f"{doc['task_id']}:{phase}" or phase in seen:
            raise ValueError(f"Duplicate or invalid message ID at index {index}")
        if not msg["body"].strip() or len(msg["body"]) > MAX_BODY:
            raise ValueError(f"Invalid message body at index {index}")
        if not msg["ref"].strip() or len(msg["ref"]) > MAX_REF:
            raise ValueError(f"Invalid message reference at index {index}")
        if phase == "proposal" and seen:
            raise ValueError("Proposal must be first")
        if phase != "proposal" and "proposal" not in seen:
            raise ValueError("Proposal missing")
        if phase == "synthesis" and not {"risk_review", "data_review"} <= seen:
            raise ValueError("Both reviews must precede synthesis")
        if "synthesis" in seen:
            raise ValueError("No phase allowed after synthesis")
        seen.add(phase)
    return doc


def load(path):
    return validate(json.loads(Path(path).read_text(encoding="utf-8")))


def status(doc):
    validate(doc)
    seen = {m["phase"] for m in doc["messages"]}
    if "proposal" not in seen:
        return "AWAITING_JJOONI_PROPOSAL"
    missing = [PHASES[p] for p in ("risk_review", "data_review") if p not in seen]
    if missing:
        return "AWAITING_" + "_AND_".join(missing)
    if "synthesis" not in seen:
        return "AWAITING_JJOONI_SYNTHESIS"
    return "REVIEW_COMPLETE_NOT_ORDER_APPROVED"


def add(doc, role, phase, body, ref):
    validate(doc)
    if phase not in PHASES or PHASES[phase] != role:
        raise ValueError("Role/phase mismatch")
    if not isinstance(body, str) or not body.strip() or len(body) > MAX_BODY:
        raise ValueError("Message must be 1–1200 characters")
    if not isinstance(ref, str) or not ref.strip() or len(ref) > MAX_REF:
        raise ValueError("Provide a short, verifiable reference or UNKNOWN")
    if any(m["phase"] == phase for m in doc["messages"]):
        raise ValueError("Duplicate phase; use a new task for another review cycle")
    msg = {"id": f"{doc['task_id']}:{phase}", "role": role,
           "phase": phase, "body": body.strip(), "ref": ref.strip()}
    validate({**doc, "messages": [*doc["messages"], msg]})
    doc["messages"].append(msg)
    return doc


def handoff(doc):
    """Minimal handoff. This file alone does not authenticate who wrote a role."""
    validate(doc)
    return {"task_id": doc["task_id"], "status": status(doc),
            "items": [{"phase": m["phase"], "role": m["role"],
                       "body": m["body"], "ref": m["ref"]}
                      for m in doc["messages"]]}


def save(path, doc):
    """Write atomically on one filesystem; Git branch concurrency needs SHA/PR controls."""
    validate(doc)
    path = Path(path)
    tmp_path = None
    try:
        with tempfile.NamedTemporaryFile("w", encoding="utf-8", dir=path.parent,
                                         prefix=f".{path.name}.", suffix=".tmp", delete=False) as f:
            tmp_path = Path(f.name)
            json.dump(doc, f, ensure_ascii=False, indent=2)
            f.write("\n")
            f.flush()
            os.fsync(f.fileno())
        os.replace(tmp_path, path)
    finally:
        if tmp_path is not None and tmp_path.exists():
            tmp_path.unlink()


def main(argv=None):
    parser = argparse.ArgumentParser(description="Offline relay; no API/model calls")
    parser.add_argument("action", choices=("status", "handoff", "add"))
    parser.add_argument("task", type=Path)
    parser.add_argument("--role", choices=ROLES)
    parser.add_argument("--phase", choices=tuple(PHASES))
    parser.add_argument("--body")
    parser.add_argument("--ref")
    args = parser.parse_args(argv)
    try:
        doc = load(args.task)
        if args.action == "add":
            if not all((args.role, args.phase, args.body, args.ref)):
                parser.error("add requires --role --phase --body --ref")
            add(doc, args.role, args.phase, args.body, args.ref)
            save(args.task, doc)
            print(status(doc))
        elif args.action == "handoff":
            print(json.dumps(handoff(doc), ensure_ascii=False, separators=(",", ":")))
        else:
            print(status(doc))
    except (ValueError, OSError, json.JSONDecodeError) as e:
        parser.error(str(e))


if __name__ == "__main__":
    main()
