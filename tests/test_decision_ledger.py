import json
import sys
import tempfile
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "tools"))
import decision_ledger as dl  # noqa: E402

GOOD = {
    "decision_id": "2026-11-09-01", "kst": "2026-11-09T10:40+09:00", "topic": "TRI-POD signal",
    "final": "BIPOD 유지", "status": "ADOPTED", "review_at": ["T+1", "T+5"],
    "inputs": {"ndx_close": 26989.99, "vix10": 20.19},
}


def write_tree(decisions, reviews=()):
    tmp = tempfile.mkdtemp()
    d = Path(tmp) / "2026" / "11"
    d.mkdir(parents=True)
    (d / "daily-decisions.jsonl").write_text("\n".join(json.dumps(x, ensure_ascii=False) for x in decisions), encoding="utf-8")
    (d / "outcome-reviews.jsonl").write_text("\n".join(json.dumps(x, ensure_ascii=False) for x in reviews), encoding="utf-8")
    return Path(tmp)


class DecisionLedgerTest(unittest.TestCase):
    def test_repository_ledger_passes(self):
        root = Path(__file__).resolve().parent.parent / "investment-decisions"
        self.assertEqual(dl.validate_tree(root), [])

    def test_good_record(self):
        self.assertEqual(dl.validate_tree(write_tree([GOOD])), [])

    def test_missing_required_field(self):
        bad = {k: v for k, v in GOOD.items() if k != "final"}
        self.assertTrue(any("missing 'final'" in e for e in dl.validate_tree(write_tree([bad]))))

    def test_private_key_blocked(self):
        bad = dict(GOOD, inputs={"qty": 45})
        self.assertTrue(any("forbidden private key" in e for e in dl.validate_tree(write_tree([bad]))))

    def test_private_phrase_blocked(self):
        bad = dict(GOOD, final="평단 25만원 기준 보유")
        self.assertTrue(any("forbidden private phrase" in e for e in dl.validate_tree(write_tree([bad]))))

    def test_duplicate_id_rejected(self):
        self.assertTrue(any("duplicate decision_id" in e for e in dl.validate_tree(write_tree([GOOD, GOOD]))))

    def test_date_mismatch_rejected(self):
        bad = dict(GOOD, kst="2026-11-10T10:40+09:00")
        self.assertTrue(any("must match kst date" in e for e in dl.validate_tree(write_tree([bad]))))

    def test_wrong_month_folder_rejected(self):
        bad = dict(GOOD, decision_id="2026-12-01-01", kst="2026-12-01T10:00+09:00")
        self.assertTrue(any("wrong month folder" in e for e in dl.validate_tree(write_tree([bad]))))

    def test_supersedes_must_exist(self):
        bad = dict(GOOD, decision_id="2026-11-09-02", supersedes="2026-11-01-01")
        self.assertTrue(any("supersedes unknown" in e for e in dl.validate_tree(write_tree([GOOD, bad]))))

    def test_review_links_and_types(self):
        ok = {"decision_id": "2026-11-09-01", "horizon": "T+5", "asof_kst": "2026-11-16T07:00+09:00",
              "verdict": "CORRECT", "executed": False, "note": "신호 유지 맞음"}
        self.assertEqual(dl.validate_tree(write_tree([GOOD], [ok])), [])
        orphan = dict(ok, decision_id="2026-11-08-01")
        self.assertTrue(any("unknown decision_id" in e for e in dl.validate_tree(write_tree([GOOD], [orphan]))))
        not_bool = dict(ok, executed="no")
        self.assertTrue(any("executed must be boolean" in e for e in dl.validate_tree(write_tree([GOOD], [not_bool]))))

    def test_invalid_json_line(self):
        root = write_tree([GOOD])
        p = root / "2026" / "11" / "daily-decisions.jsonl"
        p.write_text(p.read_text(encoding="utf-8") + "\n{not json", encoding="utf-8")
        self.assertTrue(any("invalid JSON" in e for e in dl.validate_tree(root)))


if __name__ == "__main__":
    unittest.main()
