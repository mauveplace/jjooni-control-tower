import json
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "tools"))
import decision_ledger as dl  # noqa: E402

GOOD = {
    "decision_id": "2026-11-09-01", "kst": "2026-11-09T10:40+09:00", "topic": "TRI-POD signal",
    "final": "BIPOD 유지", "status": "ADOPTED", "consensus": "AGREED",
    "owner_decision": "NOT_REQUIRED", "execution": "NOT_APPLICABLE", "review_at": ["T+1", "T+5"],
    "inputs": {"ndx_close": 26989.99, "vix10": 20.19},
    "inputs_meta": {"source": "Yahoo ^NDX", "observed_at_kst": "2026-11-09T10:26+09:00",
                    "verification": "INDEPENDENTLY_VERIFIED"},
    "roy": "52주 고점 대비 -13.56%",
}
REVIEW = {"decision_id": "2026-11-09-01", "horizon": "T+5", "asof_kst": "2026-11-16T07:00+09:00",
          "verdict": "CORRECT", "executed": False, "note": "신호 유지 맞음"}


def lines(objs):
    return "\n".join(json.dumps(x, ensure_ascii=False) for x in objs) + ("\n" if objs else "")


def write_tree(decisions, reviews=(), root=None):
    root = Path(root or tempfile.mkdtemp())
    d = root / "2026" / "11"
    d.mkdir(parents=True, exist_ok=True)
    (d / "daily-decisions.jsonl").write_text(lines(decisions), encoding="utf-8")
    (d / "outcome-reviews.jsonl").write_text(lines(list(reviews)), encoding="utf-8")
    return root


def errs_for(decisions, reviews=()):
    return dl.validate_tree(write_tree(decisions, reviews))


def has(errs, text):
    return any(text in e for e in errs)


class SchemaTest(unittest.TestCase):
    def test_repository_ledger_passes(self):
        root = Path(__file__).resolve().parent.parent / "investment-decisions"
        self.assertEqual(dl.validate_tree(root), [])

    def test_good_record(self):
        self.assertEqual(errs_for([GOOD]), [])

    def test_empty_ledger_fails(self):
        self.assertTrue(has(dl.validate_tree(Path(tempfile.mkdtemp())), "empty ledger is never a PASS"))
        self.assertTrue(has(errs_for([]), "zero decisions"))

    def test_missing_required_field(self):
        for field in ("final", "consensus", "owner_decision", "execution"):
            bad = {k: v for k, v in GOOD.items() if k != field}
            self.assertTrue(has(errs_for([bad]), f"missing '{field}'"), field)

    def test_executed_requires_owner_approval(self):
        bad = dict(GOOD, execution="EXECUTED", owner_decision="PENDING")
        self.assertTrue(has(errs_for([bad]), "requires owner_decision=APPROVED"))
        ok = dict(GOOD, execution="EXECUTED", owner_decision="APPROVED")
        self.assertEqual(errs_for([ok]), [])

    def test_inputs_require_provenance(self):
        bad = {k: v for k, v in GOOD.items() if k != "inputs_meta"}
        self.assertTrue(has(errs_for([bad]), "requires 'inputs_meta'"))
        bad2 = dict(GOOD, inputs_meta={"source": "x", "observed_at_kst": "2026-11-09T10:26+09:00", "verification": "TRUST_ME"})
        self.assertTrue(has(errs_for([bad2]), "verification must be one of"))

    def test_duplicate_id_and_dates(self):
        self.assertTrue(has(errs_for([GOOD, GOOD]), "duplicate decision_id"))
        self.assertTrue(has(errs_for([dict(GOOD, kst="2026-11-10T10:40+09:00")]), "must match kst date"))
        wrong = dict(GOOD, decision_id="2026-12-01-01", kst="2026-12-01T10:00+09:00")
        self.assertTrue(has(errs_for([wrong]), "wrong month folder"))

    def test_supersedes_must_exist(self):
        bad = dict(GOOD, decision_id="2026-11-09-02", supersedes="2026-11-01-01")
        self.assertTrue(has(errs_for([GOOD, bad]), "supersedes unknown"))

    def test_invalid_json_line(self):
        root = write_tree([GOOD])
        p = root / "2026" / "11" / "daily-decisions.jsonl"
        p.write_text(p.read_text(encoding="utf-8") + "{not json\n", encoding="utf-8")
        self.assertTrue(has(dl.validate_tree(root), "invalid JSON"))


class PrivacyTest(unittest.TestCase):
    def test_private_key_blocked(self):
        self.assertTrue(has(errs_for([dict(GOOD, inputs={"qty": 45})]), "forbidden private key"))

    def test_private_phrase_blocked(self):
        self.assertTrue(has(errs_for([dict(GOOD, final="평단 기준 보유")]), "forbidden private phrase"))

    def test_free_text_amounts_blocked(self):
        for text in ("삼성전자 15주 매도", "300만원 추가매수", "₩5,000,000 투입", "sell 230 shares"):
            self.assertTrue(has(errs_for([dict(GOOD, final=text)]), "possible private"), text)

    def test_market_terms_not_false_positive(self):
        for text in ("52주 고점 대비 -13.56%", "환율 1,361원", "NDX 26,079 하회", "3주간 박스권", "QLD 5%씩 상한 25%"):
            self.assertEqual(errs_for([dict(GOOD, final=text)]), [], text)


class ReviewTest(unittest.TestCase):
    def test_good_review(self):
        self.assertEqual(errs_for([GOOD], [REVIEW]), [])

    def test_orphan_and_type(self):
        self.assertTrue(has(errs_for([GOOD], [dict(REVIEW, decision_id="2026-11-08-01")]), "unknown decision_id"))
        self.assertTrue(has(errs_for([GOOD], [dict(REVIEW, executed="no")]), "executed must be boolean"))

    def test_duplicate_review(self):
        self.assertTrue(has(errs_for([GOOD], [REVIEW, REVIEW]), "duplicate review"))

    def test_horizon_must_be_scheduled(self):
        self.assertTrue(has(errs_for([GOOD], [dict(REVIEW, horizon="T+20")]), "not in decision"))

    def test_review_after_decision(self):
        self.assertTrue(has(errs_for([GOOD], [dict(REVIEW, asof_kst="2026-11-09T09:00+09:00")]), "must be after"))

    def test_executed_review_needs_executed_decision(self):
        self.assertTrue(has(errs_for([GOOD], [dict(REVIEW, executed=True)]), "executed=true but decision"))


class AppendOnlyTest(unittest.TestCase):
    def _repo(self):
        repo = Path(tempfile.mkdtemp())
        subprocess.run(["git", "init", "-q", str(repo)], check=True)
        root = repo / "investment-decisions"
        write_tree([GOOD], [], root)

        def commit(msg):
            subprocess.run(["git", "-C", str(repo), "add", "-A"], check=True)
            subprocess.run(["git", "-C", str(repo), "-c", "user.name=t", "-c", "user.email=t@t", "commit", "-q", "-m", msg], check=True)
        commit("base")
        base = subprocess.run(["git", "-C", str(repo), "rev-parse", "HEAD"], check=True, capture_output=True, text=True).stdout.strip()
        return repo, root, base

    def test_append_is_allowed(self):
        repo, root, base = self._repo()
        write_tree([GOOD, dict(GOOD, decision_id="2026-11-09-02", supersedes="2026-11-09-01")], [], root)
        self.assertEqual(dl.append_only_errors(repo, root, base), [])

    def test_modification_blocked(self):
        repo, root, base = self._repo()
        write_tree([dict(GOOD, final="TRIPOD 전환")], [], root)
        self.assertTrue(has(dl.append_only_errors(repo, root, base), "was modified"))

    def test_line_removal_blocked(self):
        repo, root, base = self._repo()
        write_tree([], [], root)
        self.assertTrue(has(dl.append_only_errors(repo, root, base), "was removed"))

    def test_file_deletion_blocked(self):
        repo, root, base = self._repo()
        (root / "2026" / "11" / "daily-decisions.jsonl").unlink()
        self.assertTrue(has(dl.append_only_errors(repo, root, base), "was deleted"))

    def test_bad_base_ref_fails_closed(self):
        repo, root, _ = self._repo()
        self.assertTrue(has(dl.append_only_errors(repo, root, "no-such-ref"), "cannot read base ref"))


if __name__ == "__main__":
    unittest.main()
