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
    r"(?=\s|-->)(?P<rest>(?:(?!-->).)*)-->\s*$"
)
_ATTR = re.compile(r"(?:^|\s)([A-Za-z][\w-]*)=([^\s>]+)")
_HEAD = re.compile(r"^[0-9a-f]{40}$")
_TASK = re.compile(r"^[A-Za-z0-9][A-Za-z0-9_.-]{2,127}$")
_VERDICT_LINE = re.compile(
    r"^(?:ROY_REVIEW\s*=\s*|ROY\s+review\s*:\s*)"
    r"(PASS|NEEDS_CHANGES|BLOCKED)\b",
    re.IGNORECASE,
)
_ASCII_ISSUE = re.compile(r"^[1-9][0-9]{0,9}$")


def _find_unquoted_verdicts(body):
    """Read only top-level declarations, excluding block quotes and code."""
    verdicts = set()
    fence = None  # (delimiter character, minimum closing run length)
    for line in body.splitlines():
        spaces = len(line) - len(line.lstrip(" "))
        if line.startswith("\t") or (spaces < 4 and line[spaces:].startswith("\t")):
            continue
        stripped = line[spaces:]

        # A code fence may be indented at most three spaces. A closing fence
        # must use the same character and be at least as long as its opener.
        marker = stripped[:1]
        marker_len = (
            len(stripped) - len(stripped.lstrip(marker))
            if marker in ("~", chr(96)) else 0
        )
        is_fence_line = spaces <= 3 and marker_len >= 3
        if fence is not None:
            if (is_fence_line and marker == fence[0]
                    and marker_len >= fence[1]
                    and not stripped[marker_len:].strip()):
                fence = None
            continue
        if spaces >= 4 or stripped.startswith(">"):
            continue
        if is_fence_line:
            fence = (marker, marker_len)
            continue

        stripped = re.sub(r"^#{1,6}\s+", "", stripped)
        stripped = stripped.lstrip("*").strip()
        m = _VERDICT_LINE.match(stripped)
        if m:
            verdicts.add(m.group(1).upper())
    return verdicts

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
    pairs = _ATTR.findall(rest)
    # Reject ambiguous duplicate HEAD, task, actor or other attributes.
    if len(pairs) != len({key for key, _ in pairs}):
        return None
    fields = dict(pairs)
    if any(fields.get(key, "ROY") != "ROY" for key in ("actor", "reviewer")):
        return None
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

    verdicts = _find_unquoted_verdicts(body)
    if len(verdicts) != 1:
        return None

    source_issue = fields.get("source-issue")
    generic_issue = fields.get("issue")
    if (source_issue is not None and generic_issue is not None
            and source_issue != generic_issue):
        return None
    source_issue = source_issue if source_issue is not None else generic_issue
    if source_issue is not None and not _ASCII_ISSUE.fullmatch(source_issue):
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
