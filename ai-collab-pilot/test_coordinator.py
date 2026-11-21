import json
import unittest
from pathlib import Path
import tempfile
import sys
sys.path.insert(0, str(Path(__file__).parent))
from coordinator import template, parse_comment, summarize, validate_task, main

SHA = "8836f699b1676bc015fe13032ee3e98198a57976"

class CoordinatorTests(unittest.TestCase):
    def setUp(self):
        self.task = {"task_id":"D-261108-TRIPOD-DQ-002", "head_sha":SHA,
                     "mode":"SYSTEM_REVIEW_ONLY","privacy":"PUBLIC_DATA_ONLY",
                     "objective":"Independently assess historical signal data contamination."}
    def comment(self, actor, sha=SHA, task_id=None, id=1):
        raw = template({**self.task, "head_sha":sha,"task_id":task_id or self.task["task_id"]}, actor)
        return {"id":id, "body":raw.replace("Verdict: [PASS / BLOCKED / NEEDS_DATA]", "Verdict: BLOCKED"),
                "user":{"login":"mauveplace"},"html_url":f"https://github.com/example/pr/{id}"}
    def test_empty(self):
        result = summarize(self.task, [])
        self.assertEqual(result["state"], "WAITING_FOR_ROY_AND_JJANGGU")
        self.assertFalse(result["safe_to_trade"])
        self.assertFalse(result["safe_to_deploy"])
    def test_one_review(self):
        result = summarize(self.task, [self.comment("ROY")])
        self.assertEqual(result["missing_reviews"], ["JJANGGU"])
    def test_both_still_need_verification(self):
        result = summarize(self.task, [self.comment("ROY"),self.comment("JJANGGU",id=2)])
        self.assertEqual(result["state"], "AWAITING_HUMAN_SOURCE_VERIFICATION")
        self.assertEqual(result["reviews"]["ROY"][0]["provenance"], "UNVERIFIED_ROLE_CLAIM")
        self.assertEqual(result["agent_authentication"], "NOT_ESTABLISHED_BY_GITHUB_COMMENT")
    def test_duplicate_claims(self):
        result = summarize(self.task, [self.comment("ROY",id=1),self.comment("ROY",id=2),self.comment("JJANGGU",id=3)])
        self.assertEqual(result["state"], "DUPLICATE_CLAIMS_REVIEW_REQUIRED")
        self.assertEqual(result["duplicate_claims"], {"ROY":2})
    def test_wrong_snapshot_and_task_ignored(self):
        other = "0"*40
        result = summarize(self.task, [self.comment("ROY",sha=other),self.comment("JJANGGU",task_id="OTHER")])
        self.assertEqual(result["missing_reviews"],["ROY","JJANGGU"])
    def test_fake_request_not_counted(self):
        result = summarize(self.task, [{"id":1, "body":"## JJANGGU / COLLAB REVIEW\nNo marker"}])
        self.assertEqual(result["missing_reviews"],["ROY","JJANGGU"])
    def test_invalid_task(self):
        with self.assertRaises(ValueError):
            validate_task({**self.task,"privacy":"PRIVATE_DATA"})
    def test_file_cli(self):
        with tempfile.TemporaryDirectory() as d:
            task = Path(d)/"task.json"; comments = Path(d)/"comments.json"
            task.write_text(json.dumps(self.task), encoding="utf-8")
            comments.write_text(json.dumps([self.comment("ROY")]), encoding="utf-8")
            from contextlib import redirect_stdout
            from io import StringIO
            out=StringIO()
            with redirect_stdout(out): main(["status","--task",str(task),"--comments",str(comments)])
            self.assertEqual(json.loads(out.getvalue())["missing_reviews"],["JJANGGU"])
    def test_null_body_is_not_reply(self):
        self.assertIsNone(parse_comment({"id":1,"body":None}))
        self.assertIsNone(parse_comment({"id":2,"body": "<!-- JJOONI-COLLAB-V2 task=X actor=ROY kind=review head="+SHA+" -->\n"}))

if __name__ == "__main__":
    unittest.main()
