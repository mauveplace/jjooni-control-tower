"""Unit regression tests for the read-only Windows PC relay. No external services."""
import importlib.util
from pathlib import Path
import sys
import tempfile
import unittest
from unittest.mock import patch

FILE = Path(__file__).resolve().parents[1] / "ai-collab" / "pc-relay" / "pc_relay.py"
spec = importlib.util.spec_from_file_location("pc_relay", FILE)
relay = importlib.util.module_from_spec(spec)
sys.modules["pc_relay"] = relay
spec.loader.exec_module(relay)

HEAD = "a" * 40
def valid_pr():
    return {"number": 9999, "title": "[AI-COLLAB] read-only review",
            "head": {"sha": HEAD}, "base": {"ref": "main"},
            "created_at": "2026-11-19T14:00:00Z"}

def valid_task():
    return {"schema": "JJOONI_COLLAB_V4",
            "repository": relay.REPO, "base_branch": "main",
            "mode": "SYSTEM_REVIEW_ONLY", "task_id": "TEST-PR-9999",
            "required_reviewers": ["ROY"]}

class RelayTests(unittest.TestCase):
    def test_review_header_exact_head(self):
        header = f"<!-- JJOONI-COLLAB-V4 task=TEST-PR-9999 actor=ROY stage=review head={HEAD} -->"
        self.assertIsNotNone(relay.V4.match(header))
        self.assertIsNone(relay.V4.match(header.replace("actor=ROY", "actor=JJOONI")))
        self.assertIsNone(relay.V4.match(header.replace(HEAD, "z" * 40)))

    def test_task_must_be_single_changed_active_json(self):
        pr = valid_pr()
        file = relay.TASK_ROOT + "TEST-PR-9999.json"
        with patch.object(relay, "gh_api", return_value=[
                {"filename": file, "status": "added"}]), patch.object(relay, "read_task", return_value=valid_task()):
            self.assertEqual(relay.pr_task(pr)["task_id"], "TEST-PR-9999")
        with patch.object(relay, "gh_api", return_value=[
                {"filename": file, "status": "added"},
                {"filename": relay.TASK_ROOT+"OTHER.json", "status": "added"}]):
            self.assertIsNone(relay.pr_task(pr))

    def test_task_rejects_write_mode(self):
        t = valid_task()
        t["mode"] = "PR_BRANCH_EDIT_APPROVED"
        with patch.object(relay, "gh_api", return_value=[
                {"filename": relay.TASK_ROOT+"TEST-PR-9999.json", "status": "added"}]), patch.object(relay, "read_task", return_value=t):
            self.assertIsNone(relay.pr_task(valid_pr()))

    def test_once_only_existing_comment(self):
        marker = "JJOONI-PC-HANDOFF-V1 pr=9999 comment=123 head=" + HEAD
        with tempfile.TemporaryDirectory() as td:
            with patch.object(relay, "STATE_DIR", Path(td)), patch.object(relay, "STATE_FILE", Path(td)/"ledger.json"):
                ledger = {"events": {}, "calls": {}}
                with patch.object(relay, "gh_api", return_value=[{"body": "<!-- "+marker+" -->"}]) as api:
                    self.assertFalse(relay.emit_once(9999, marker, "mock", ledger, False))
                    self.assertEqual(api.call_count, 1)
                    self.assertEqual(ledger["events"][marker]["status"], "DONE")

    def test_dry_run_never_posts(self):
        with patch.object(relay, "gh_api", return_value=[]):
            with patch.object(relay, "log"):
                self.assertFalse(relay.emit_once(9999, "dry-key", "mock", {"events":{},"calls":{}}, True))

if __name__ == "__main__":
    unittest.main()
