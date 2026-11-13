"""Isolated retry E2 canary; deliberately RED until one-line Work correction.

No production file imports this fixture. Owner has not authorized deployment.
"""

def relay_approval_label(approval):
    """Only literal True can produce APPROVED."""
    return "APPROVED" if bool(approval) else "BLOCKED"
