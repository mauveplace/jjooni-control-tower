#!/usr/bin/env python3
"""Classify real-world ROY review-comment formats; never authenticate an agent.

Only a syntactic candidate is returned. Callers must independently verify the
original GitHub comment/review ID, current 40-digit PR HEAD, task contract,
reviewed diff, CI, and first-party Claude execution. This module makes no
network calls or writes and grants no approval to merge/deploy/trade.
"""

import re


_MARKER = re.compile(
    r"^<!--\s*(JJOONI-COLLAB-ROY-REVIEW-V4|JJOONI-COLLAB-V4|JJOONI_COLLAB_V4)"
    r"(?P<rest>.*?)-->\s*$"
)
_ATTR = re.compile(r"(?:^|\s)([A-Za-z][\w-]*)=([^\s>]+)")
_HEAD = re.compile(r"^[0-9a-f]{40}$")
_TASK = re.compile(r"^[A-Za-z0-9][A-Za-z0-9_.-]{2,127}$")
_VERDICT = re.compile(
    r"\bROY_REVIEW\s*=\s*(PASS|NEEDS_CHANGES|BLOCKED)\b"
    r"|\bROY\s+review\s*:\s*(PASS|NEEDS_CHANGES|BLOCKED)\b",
    re.IGNORECASE,
)


def parse_roy_review_candidate(comment):
    """Return a non-authoritative candidate dict, or None for unrecognized text.

    Supported review headers, all observed on real PRs:
    - JJOONI-COLLAB-ROY-REVIEW-V4 task=... head=... source-issue=...
    - JJOONI-COLLAB-V4 ROY-REVIEW task=... head=... issue=...
    - JJOONI_COLLAB_V4 ROY-REVIEW task=... head=... issue=...
    - Legacy JJOONI-COLLAB-V4 task=... actor=ROY head=...

    Verdict: ROY_REVIEW=PASS or the Markdown-compatible "ROY review: PASS".
    Marker and verdict only classify a *claim*, not first-party ROY provenance.
    """
    if not isinstance(comment, str) or not comment:
        return None
    head_line, separator, body = comment.partition("\n")
    if not separator:
        return None
    match = _MARKER.fullmatch(head_line)
    if match is None:
        return None

    stem = match.group(1)
    rest = match.group("rest")
    fields = dict(_ATTR.findall(rest))
    tagged_as_roy = (
        stem == "JJOONI-COLLAB-ROY-REVIEW-V4"
        or rest.lstrip().startswith("ROY-REVIEW ")
        or fields.get("actor") == "ROY"
        or fields.get("reviewer") == "ROY"
    )
    if not tagged_as_roy:
        return None

    task_id = fields.get("task", "")
    head_sha = fields.get("head", "")
    if not _TASK.fullmatch(task_id) or not _HEAD.fullmatch(head_sha):
        return None

    verdicts = {((m.group(1) or m.group(2)).upper()) for m in _VERDICT.finditer(body)}
    if len(verdicts) != 1:
        return None

    source_issue = fields.get("source-issue", fields.get("issue"))
    if source_issue is not None and not source_issue.isdecimal():
        return None

    return {
        "task_id": task_id,
        "reviewed_head": head_sha,
        "verdict": verdicts.pop(),
        "source_issue": int(source_issue) if source_issue is not None else None,
        "status": "UNVERIFIED_REVIEW_CANDIDATE",
        "provenance_verified": False,
        "can_merge": False,
        "can_deploy": False,
        "can_trade": False,
    }
