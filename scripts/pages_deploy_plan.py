#!/usr/bin/env python3
"""Fail-open Pages deploy planner: only observed same-SHA success is a no-op."""
import argparse
import json
import re
import subprocess
import sys


def gh_json(repo, path, run=subprocess.run):
    response = run(
        ["gh", "api", f"/repos/{repo}/{path}"],
        check=True, capture_output=True, text=True, timeout=20,
    )
    return json.loads(response.stdout)


def decide(repo, sha, run=subprocess.run):
    """Return (must_deploy, reason). API problems never suppress deployment."""
    try:
        deployments = gh_json(
            repo, "deployments?environment=github-pages&per_page=20", run=run
        )
        if not isinstance(deployments, list) or not deployments:
            return True, "NO_PREVIOUS_DEPLOYMENTS"
        newest = max(
            deployments,
            key=lambda d: (str(d.get("created_at") or ""), int(d.get("id") or 0)),
        )
        if newest.get("sha") != sha:
            return True, "NEW_SHA"
        deploy_id = newest.get("id")
        if not deploy_id:
            return True, "DEPLOYMENT_ID_MISSING"
        statuses = gh_json(
            repo, f"deployments/{deploy_id}/statuses?per_page=20", run=run
        )
        if not isinstance(statuses, list) or not statuses:
            return True, "STATUS_MISSING"
        latest = max(
            statuses,
            key=lambda d: (str(d.get("created_at") or ""), int(d.get("id") or 0)),
        )
        state = str(latest.get("state") or "UNKNOWN")
        if state == "success":
            return False, "ALREADY_PUBLISHED_SAME_SHA"
        # In-progress/queued attempts are serialized by workflow concurrency;
        # any non-success state deliberately remains visible and retryable.
        return True, "NOT_SUCCESS_" + re.sub(r"[^A-Z0-9_]", "_", state.upper())
    except Exception as exc:  # malformed provider JSON must not suppress retry
        print(
            "::warning::Pages deployment status cannot be verified; "
            f"retry instead of hiding an error ({type(exc).__name__})",
            file=sys.stderr,
        )
        return True, "STATUS_CHECK_UNAVAILABLE"


def main(argv=None):
    parser = argparse.ArgumentParser()
    parser.add_argument("--repo", required=True)
    parser.add_argument("--sha", required=True)
    args = parser.parse_args(argv)
    if not re.fullmatch(r"[0-9a-f]{40}", args.sha):
        parser.error("expected exactly 40 hex characters for pinned source SHA")
    needed, reason = decide(args.repo, args.sha)
    # Stdout is used as the GitHub step output (GITHUB_OUTPUT).
    print(f"should_deploy={'true' if needed else 'false'}")
    print(f"PAGES_DEPLOY_PLAN={reason} sha={args.sha}", file=sys.stderr)


if __name__ == "__main__":
    main()
