"""Pure, deliberately isolated L2 GitHub handoff regression fixture.

This module is not imported by any production workflow and MUST NOT be merged
or deployed from the L2 test PR. It has a known failing cross-PR dedupe case
for an event-driven ROY -> JJOONI automatic repair experiment.
"""
import re

_REPO = re.compile(r"^[A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+$")


def review_receipt_key(repository, pr_number, source_comment_id):
    """Return a stable identifier for one genuine review-comment receipt.

    Expected scope: the repository, PR number and source comment ID together.
    Never use GitHub commenter login or an AI signature as a trusted identity.
    """
    if not isinstance(repository, str) or not _REPO.fullmatch(repository):
        raise ValueError("repository must be owner/name")
    if type(pr_number) is not int or pr_number < 1:
        raise ValueError("PR number must be a positive integer")
    if type(source_comment_id) is not int or source_comment_id < 1:
        raise ValueError("source comment ID must be a positive integer")

    # L2 REVIEW TARGET: currently ignores repository and PR, causing collisions.
    return "review-receipt:" + str(source_comment_id)
