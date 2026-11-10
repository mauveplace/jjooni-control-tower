"""Behavioral regressions for controlled Pages deployment (no live mutation)."""
from pathlib import Path
from types import SimpleNamespace
import json
import subprocess
import sys
import tempfile
import unittest

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "scripts"))
import pages_deploy_plan as plan
import pages_site_audit as audit

SHA = "a" * 40
OTHER_SHA = "b" * 40
WORKFLOW = ROOT / ".github/workflows/pages-controlled-deploy.yml"
DAILY = ROOT / ".github/workflows/market-observatory-daily.yml"


def deployment(sha=SHA, id=10, created_at="2026-11-10T00:00:00Z"):
    return {"sha": sha, "id": id, "created_at": created_at}


def status(state="success", id=12, created_at="2026-11-10T00:01:00Z"):
    return {"state": state, "id": id, "created_at": created_at}


def mock_gh(deployments, states=None, fail=False):
    def run(cmd, **_kwargs):
        if fail:
            raise subprocess.CalledProcessError(1, cmd)
        path = cmd[2]
        if "deployments?" in path:
            body = deployments
        elif "/statuses?" in path:
            body = states or []
        else:
            raise AssertionError("unexpected GitHub API path: " + path)
        return SimpleNamespace(stdout=json.dumps(body))
    return run


class PagesDeployGateBehavior(unittest.TestCase):
    def test_exact_sha_observed_success_is_a_noop(self):
        should, why = plan.decide("mauveplace/jjooni-control-tower", SHA,
                                  run=mock_gh([deployment()], [status()]))
        self.assertFalse(should)
        self.assertEqual(why, "ALREADY_PUBLISHED_SAME_SHA")

    def test_failed_or_pending_same_sha_retries(self):
        for bad in ("failure", "in_progress", "queued", "error", "inactive"):
            with self.subTest(bad=bad):
                should, why = plan.decide(
                    "mauveplace/jjooni-control-tower", SHA,
                    run=mock_gh([deployment()], [status(bad)]))
                self.assertTrue(should)
                self.assertIn("NOT_SUCCESS", why)

    def test_different_sha_empty_deployments_or_empty_statuses_deploys(self):
        for deployments, statuses in (
            ([deployment(OTHER_SHA)], [status()]),
            ([], []),
            ([deployment()], []),
        ):
            with self.subTest(deployments=deployments):
                should, _ = plan.decide(
                    "mauveplace/jjooni-control-tower", SHA,
                    run=mock_gh(deployments, statuses))
                self.assertTrue(should)

    def test_gh_failure_never_hides_a_needed_deploy(self):
        should, why = plan.decide(
            "mauveplace/jjooni-control-tower", SHA,
            run=mock_gh([], fail=True))
        self.assertTrue(should)
        self.assertEqual(why, "STATUS_CHECK_UNAVAILABLE")

    def test_lists_are_sorted_by_creation_not_api_order(self):
        older = deployment(OTHER_SHA, id=20, created_at="2026-11-09T01:00:00Z")
        newest = deployment(SHA, id=21, created_at="2026-11-10T01:00:00Z")
        old_status = status("failure", id=30, created_at="2026-11-10T01:01:00Z")
        new_status = status("success", id=31, created_at="2026-11-10T01:02:00Z")
        should, _ = plan.decide("mauveplace/jjooni-control-tower", SHA,
                                run=mock_gh([newest, older], [new_status, old_status]))
        self.assertFalse(should)

    def test_status_api_failure_retries(self):
        calls = 0
        def broken_status(cmd, **_kwargs):
            nonlocal calls
            calls += 1
            if calls > 1:
                raise subprocess.CalledProcessError(1, cmd)
            return SimpleNamespace(stdout=json.dumps([deployment()]))
        should, _ = plan.decide("mauveplace/jjooni-control-tower", SHA, run=broken_status)
        self.assertTrue(should)


class PagesAssetAuditBehavior(unittest.TestCase):
    def test_html_js_css_local_references_must_exist(self):
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            (root / "index.html").write_text(
                '<script src="./app.js"></script><link rel="stylesheet" href="./app.css">',
                encoding="utf-8",
            )
            (root / "app.js").write_text("fetch('./data/obs.json')", encoding="utf-8")
            (root / "app.css").write_text("body{background:url('./pixel.png')}", encoding="utf-8")
            (root / "data").mkdir()
            (root / "data/obs.json").write_text("{}", encoding="utf-8")
            (root / "pixel.png").write_bytes(b"png")
            count, missing = audit.audit(root)
            self.assertGreaterEqual(count, 4)
            self.assertEqual(missing, [])
            (root / "data/obs.json").unlink()
            _, missing = audit.audit(root)
            self.assertTrue(any("obs.json" in x for x in missing))

    def test_external_and_api_paths_are_not_mistaken_for_static_files(self):
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            (root / "index.html").write_text(
                '<script src="https://cdn.example.com/app.js"></script>',
                encoding="utf-8",
            )
            (root / "app.js").write_text("fetch('/api/live/ssot.json')", encoding="utf-8")
            _, missing = audit.audit(root)
            self.assertEqual(missing, [])


class PagesWorkflowContract(unittest.TestCase):
    def test_deployment_and_retry_gates(self):
        src = WORKFLOW.read_text(encoding="utf-8")
        self.assertIn("python3 scripts/pages_deploy_plan.py", src)
        self.assertIn("bash scripts/pages_site_stage.sh", src)
        self.assertIn("ref: " + chr(36) + "{{ needs.plan.outputs.target_sha }}", src)
        self.assertIn("if: " + chr(36) + "{{ needs.plan.outputs.should_deploy == 'true' }}", src)
        self.assertIn("timeout-minutes: 15", src)
        self.assertIn("timeout-minutes: 4", src)
        self.assertIn("vars.PAGES_ACTIONS_ENABLED == 'true'", src)
        self.assertIn("deployments: read", src)
        self.assertIn("cancel-in-progress: false", src)
        self.assertIn("pages-site-preflight.yml", (ROOT / ".github/workflows/pages-site-preflight.yml").read_text(encoding="utf-8"))

    def test_preserves_public_market_data_and_excludes_dev_sources(self):
        src = (ROOT / "scripts/pages_site_stage.sh").read_text(encoding="utf-8")
        self.assertIn("python3 scripts/pages_site_audit.py", src)
        for name in ("market-observatory/data/observatory.json",
                     "market-observatory/data/economic-calendar-history.json",
                     "public-market-daily.json", "index.html"):
            self.assertIn(name, src)
        for name in (".github", "tools", "tests", "scripts", "ai-collab", "ai-collab-dispatch"):
            self.assertIn("--exclude='/" + name + "/'", src)

    def test_pages_success_does_not_trigger_market_rebuild(self):
        daily = DAILY.read_text(encoding="utf-8")
        self.assertNotIn('      - "pages build and deployment"', daily)


if __name__ == "__main__":
    unittest.main()
