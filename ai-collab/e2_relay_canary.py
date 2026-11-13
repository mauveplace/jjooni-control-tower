"""Isolated E2 workflow canary. Not imported by production code.

This fixture intentionally contains a test-detected type validation defect so an
authentic ROY code review can generate NEEDS_CHANGES before a Work correction.
It must stay in an unmerged experiment branch.
"""


def relay_approval_label(approval):
    """Only literal True qualifies as APPROVED; all other values BLOCKED."""
    # Deliberate canary bug: non-empty strings such as "no" are truthy.
    return "APPROVED" if bool(approval) else "BLOCKED"
