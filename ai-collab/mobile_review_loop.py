#!/usr/bin/env python3
"""Bounded, no-CLI review decision aid for JJOONI ↔ ROY.

This module does NOT invoke either model, read platform quotas, change GitHub
permissions, merge, deploy or certify that a claimed review came from ROY.
Agents must verify original events and first-party run provenance separately.
"""
from capacity_router import HIGH_ASSURANCE_TYPES, WORK_TYPES, COMPLEXITY_LEVELS

MAX_REVIEWS = 2
VERDICTS = frozenset(("NONE", "PASS", "NEEDS_CHANGES", "BLOCKED"))


def decide_review(*, work_type, complexity="ROUTINE", repeated_failure=False,
                  owner_requests_review=False, reviews_completed=0,
                  latest_verdict="NONE", reviewed_head_changed=False,
                  critical_findings_open=False, provenance_verified=False):
    """Return a deterministic next step, never an authorization.

    reviews_completed counts actual independent reviews, not PR comments,
    requested reviews, retry events, or unverified role markers.
    reviewed_head_changed means a material code/decision change since the
    last review; no-op commits or formatting alone do not count.
    """
    if work_type not in WORK_TYPES or complexity not in COMPLEXITY_LEVELS:
        raise ValueError("Unsupported task class")
    for value in (repeated_failure, owner_requests_review, reviewed_head_changed,
                  critical_findings_open, provenance_verified):
        if type(value) is not bool:
            raise ValueError("Boolean flags must be bool")
    if type(reviews_completed) is not int or not 0 <= reviews_completed <= MAX_REVIEWS:
        raise ValueError("Invalid independent review count")
    if latest_verdict not in VERDICTS:
        raise ValueError("Invalid independent review verdict")
    if (reviews_completed == 0 and latest_verdict != "NONE") or (
            reviews_completed > 0 and latest_verdict == "NONE"):
        raise ValueError("Review count and verdict conflict")

    mandatory = work_type in HIGH_ASSURANCE_TYPES
    suggested = mandatory or complexity != "ROUTINE" or repeated_failure or owner_requests_review
    remaining = MAX_REVIEWS - reviews_completed

    if critical_findings_open or latest_verdict == "BLOCKED":
        decision = "BLOCKED_REQUIRES_FIX"
    elif latest_verdict == "NEEDS_CHANGES":
        if not reviewed_head_changed:
            decision = "JJOONI_FIX_FIRST"
        elif remaining:
            decision = "REQUEST_ROY"
        else:
            decision = "ESCALATE_TO_OWNER"
    elif latest_verdict == "PASS":
        if reviewed_head_changed:
            decision = "REQUEST_ROY" if remaining else "ESCALATE_TO_OWNER"
        elif not provenance_verified:
            decision = "VERIFY_ROY_SOURCE"
        else:
            decision = "READY_FOR_OWNER_GATE"
    elif suggested:
        decision = "REQUEST_ROY"
    else:
        decision = "JJOONI_TESTS_ONLY"

    return {
        "decision": decision,
        "review_required_by_policy": mandatory or owner_requests_review,
        "review_recommended": suggested,
        "reviews_completed": reviews_completed,
        "reviews_remaining_before_escalation": remaining,
        "review_provenance_verified": provenance_verified,
        "safe_to_merge": False,
        "safe_to_deploy": False,
        "safe_to_trade": False,
        "requires_human_release_approval": True,
        "notes": (
            "Decision only. A GitHub comment or claimed AI marker is not "
            "proof of a first-party review. CI and deployed data remain "
            "independent release checks."
        ),
    }
