import contextlib
import io
import json
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parent))
from relay import add, handoff, load, main, save, status


class RelayTests(unittest.TestCase):
    def setUp(self):
        self.doc = {"task_id": "TRIAL-1", "messages": []}

    def test_complete_cycle(self):
        self.assertEqual(status(self.doc), "AWAITING_JJOONI_PROPOSAL")
        add(self.doc, "JJOONI", "proposal", "First draft.", "draft-v1")
        self.assertEqual(status(self.doc), "AWAITING_ROY_AND_JJANGGU")
        add(self.doc, "ROY", "risk_review", "Check look-ahead.", "risk-v1")
        self.assertEqual(status(self.doc), "AWAITING_JJANGGU")
        add(self.doc, "JJANGGU", "data_review", "Price data absent.", "UNKNOWN")
        self.assertEqual(status(self.doc), "AWAITING_JJOONI_SYNTHESIS")
        add(self.doc, "JJOONI", "synthesis", "Do not assert unverified performance.", "final-v1")
        self.assertEqual(status(self.doc), "REVIEW_COMPLETE_NOT_ORDER_APPROVED")
        self.assertEqual(len(handoff(self.doc)["items"]), 4)

    def test_wrong_role_and_order(self):
        with self.assertRaises(ValueError): add(self.doc, "ROY", "proposal", "bad", "1")
        with self.assertRaises(ValueError): add(self.doc, "ROY", "risk_review", "bad", "1")
        add(self.doc, "JJOONI", "proposal", "draft", "1")
        with self.assertRaises(ValueError): add(self.doc, "JJOONI", "synthesis", "too early", "1")
        with self.assertRaises(ValueError): add(self.doc, "JJOONI", "proposal", "duplicate", "2")

    def test_length_guard(self):
        with self.assertRaises(ValueError): add(self.doc, "JJOONI", "proposal", "a" * 1201, "1")
        with self.assertRaises(ValueError): add(self.doc, "JJOONI", "proposal", "valid", "")

    def test_load_rejects_manual_tamper(self):
        with tempfile.TemporaryDirectory() as d:
            path = Path(d) / "task.json"
            for bad in [
                {"task_id":"TRIAL-1","messages":[{"id":"x", "role":"ROY","phase":"proposal","body":"x","ref":"x"}]},
                {"task_id":"TRIAL-1","messages":[{"id":"TRIAL-1:proposal", "role":"JJOONI","phase":"proposal","body":"x","ref":"x"}]*2},
                {"task_id":"TRIAL-1","messages":[{"id":"TRIAL-1:synthesis", "role":"JJOONI","phase":"synthesis","body":"x","ref":"x"}]},
                {"task_id":"TRIAL-1","messages": "not a list"},
            ]:
                path.write_text(json.dumps(bad), encoding="utf-8")
                with self.assertRaises(ValueError): load(path)

    def test_save_and_handoff_cli_json(self):
        with tempfile.TemporaryDirectory() as d:
            path = Path(d) / "task.json"
            save(path, self.doc)
            stream = io.StringIO()
            with contextlib.redirect_stdout(stream):
                main(["handoff", str(path)])
            result = json.loads(stream.getvalue())
            self.assertEqual(result["status"], "AWAITING_JJOONI_PROPOSAL")
            self.assertEqual(load(path), self.doc)

    def test_cli_rejects_corrupt_file(self):
        with tempfile.TemporaryDirectory() as d:
            path = Path(d) / "task.json"
            path.write_text('{"task_id":"TRIAL-1","messages":[{"phase":"proposal"}]}', encoding="utf-8")
            process = subprocess.run([sys.executable, "-O", str(Path(__file__).parent / "relay.py"),
                                      "status", str(path)], capture_output=True, text=True)
            self.assertNotEqual(process.returncode, 0)
            self.assertIn("Invalid message shape", process.stderr)


if __name__ == "__main__":
    unittest.main()
