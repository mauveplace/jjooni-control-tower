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
# Decision 2026-11-09 10:40 KST (= 11/08 20:40 ET). US T+1 = 11/09 session ... T+5 = 11/13 session,
# which closes 2026-11-14 06:00 KST.
REVIEW = {"decision_id": "2026-11-09-01", "horizon": "T+5", "asof_kst": "2026-11-16T07:00+09:00",
          "verdict": "CORRECT", "executed": False, "outcome_basis": "COUNTERFACTUAL",
          "market": "US", "matured_session_date": "2026-11-13", "calendar_basis": "AUTO_NYSE_RULES",
          "note": "신호 유지 맞음"}
EXECUTED_DEC = dict(GOOD, execution="EXECUTED", owner_decision="APPROVED")


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
        for text in ("삼성전자 15주 매도", "300만원 추가매수", "₩5,000,000 투입", "sell 230 shares",
                     "52주 매도", "52 주 보유", "52주, 매수"):
            self.assertTrue(has(errs_for([dict(GOOD, final=text)]), "possible private"), text)

    def test_market_terms_not_false_positive(self):
        for text in ("52주 고점 대비 -13.56%", "52주 신고가", "52주 낙폭", "환율 1,361원", "NDX 26,079 하회",
                     "3주간 박스권", "QLD 5%씩 상한 25%"):
            self.assertEqual(errs_for([dict(GOOD, final=text)]), [], text)


    def test_markdown_scorecards_scanned(self):
        root = write_tree([GOOD])
        (root / "weekly").mkdir()
        (root / "weekly" / "2026-W46.md").write_text("이번 주 삼성전자 15주 매도\n", encoding="utf-8")
        self.assertTrue(has(dl.validate_tree(root), "weekly/2026-W46.md:1: possible private"))
        (root / "weekly" / "2026-W46.md").write_text("예수금 확인\n", encoding="utf-8")
        self.assertTrue(has(dl.validate_tree(root), "forbidden private phrase '예수금'"))


class ProvenanceTest(unittest.TestCase):
    def test_lookahead_observation_blocked(self):
        meta = dict(GOOD["inputs_meta"], observed_at_kst="2027-01-01T10:00+09:00")
        self.assertTrue(has(errs_for([dict(GOOD, inputs_meta=meta)]), "look-ahead"))

    def test_empty_source_blocked(self):
        for src in ("", "   "):
            meta = dict(GOOD["inputs_meta"], source=src)
            self.assertTrue(has(errs_for([dict(GOOD, inputs_meta=meta)]), "source must be a non-empty string"), repr(src))

    def test_per_field_provenance(self):
        ok_fields = {"vix10": {"source": "Yahoo ^VIX", "observed_at_kst": "2026-11-09T10:20+09:00"}}
        meta = dict(GOOD["inputs_meta"], fields=ok_fields)
        self.assertEqual(errs_for([dict(GOOD, inputs_meta=meta)]), [])
        bad_key = dict(GOOD["inputs_meta"], fields={"sox": {"source": "x", "observed_at_kst": "2026-11-09T10:20+09:00"}})
        self.assertTrue(has(errs_for([dict(GOOD, inputs_meta=bad_key)]), "no matching inputs key"))
        late = dict(GOOD["inputs_meta"], fields={"vix10": {"source": "x", "observed_at_kst": "2026-11-09T11:00+09:00"}})
        self.assertTrue(has(errs_for([dict(GOOD, inputs_meta=late)]), "look-ahead"))


class ReviewTest(unittest.TestCase):
    def test_good_review(self):
        self.assertEqual(errs_for([GOOD], [REVIEW]), [])

    def test_orphan_and_type(self):
        self.assertTrue(has(errs_for([GOOD], [dict(REVIEW, decision_id="2026-11-08-01")]), "unknown decision_id"))
        self.assertTrue(has(errs_for([GOOD], [dict(REVIEW, executed="no")]), "executed must be boolean"))

    def test_duplicate_review(self):
        self.assertTrue(has(errs_for([GOOD], [REVIEW, REVIEW]), "duplicate COUNTERFACTUAL review"))

    def test_horizon_must_be_scheduled(self):
        self.assertTrue(has(errs_for([GOOD], [dict(REVIEW, horizon="T+20")]), "not in decision"))

    def test_review_after_decision(self):
        self.assertTrue(has(errs_for([GOOD], [dict(REVIEW, asof_kst="2026-11-09T09:00+09:00")]), "must be after"))

    def test_t0_not_a_horizon(self):
        self.assertTrue(has(errs_for([dict(GOOD, review_at=["T+0"])]), "review_at must be"))

    def test_review_before_maturity_blocked(self):
        early = dict(REVIEW, asof_kst="2026-11-09T10:41+09:00")
        self.assertTrue(has(errs_for([GOOD], [early]), "before the US close"))
        too_soon = dict(REVIEW, matured_session_date="2026-11-11", asof_kst="2026-11-12T07:00+09:00")
        self.assertTrue(has(errs_for([GOOD], [too_soon]), "cannot mature on 2026-11-11"))
        weekend = dict(REVIEW, matured_session_date="2026-11-14", asof_kst="2026-11-16T07:00+09:00")
        self.assertTrue(has(errs_for([GOOD], [weekend]), "is a weekend"))

    def test_t1_us_same_day_close(self):
        t1 = dict(REVIEW, horizon="T+1", matured_session_date="2026-11-09", asof_kst="2026-11-10T06:30+09:00")
        self.assertEqual(errs_for([GOOD], [t1]), [])

    def test_krx_market(self):
        krx = dict(REVIEW, horizon="T+1", market="KRX", matured_session_date="2026-11-09", asof_kst="2026-11-09T16:00+09:00",
                   calendar_basis="DECLARED_WITH_SOURCE",
                   calendar_evidence={"source": "KRX 휴장일 공지", "checked_by": "ROY", "holidays_skipped": []})
        self.assertEqual(errs_for([GOOD], [krx]), [])
        early = dict(krx, asof_kst="2026-11-09T15:00+09:00")
        self.assertTrue(has(errs_for([GOOD], [early]), "before the KRX close"))

    def test_tn_requires_session_fields(self):
        bare = {k: v for k, v in REVIEW.items() if k not in ("market", "matured_session_date", "calendar_basis")}
        e = errs_for([GOOD], [bare])
        for k in ("market", "matured_session_date", "calendar_basis"):
            self.assertTrue(has(e, f"missing '{k}'"), k)

    def test_actual_vs_counterfactual(self):
        actual = dict(REVIEW, executed=True, outcome_basis="ACTUAL", execution_evidence="PRIVATE_REF:ct-2026-11-10-a1")
        self.assertEqual(errs_for([EXECUTED_DEC], [actual]), [])
        self.assertTrue(has(errs_for([GOOD], [actual]), "ACTUAL outcome but decision"))
        no_ev = {k: v for k, v in actual.items() if k != "execution_evidence"}
        self.assertTrue(has(errs_for([EXECUTED_DEC], [no_ev]), "requires execution_evidence"))
        raw_ev = dict(actual, execution_evidence="230 shares @59.78")
        self.assertTrue(has(errs_for([EXECUTED_DEC], [raw_ev]), "requires execution_evidence"))
        mismatch = dict(REVIEW, executed=True)
        self.assertTrue(has(errs_for([GOOD], [mismatch]), "COUNTERFACTUAL requires executed=false"))
        # a counterfactual comparison on an executed decision is allowed and kept separate
        self.assertEqual(errs_for([EXECUTED_DEC], [REVIEW]), [])

    # --- JJOONI round 3 ---------------------------------------------------------------
    def test_actual_and_counterfactual_same_horizon(self):
        actual = dict(REVIEW, executed=True, outcome_basis="ACTUAL", execution_evidence="PRIVATE_REF:test001")
        self.assertEqual(errs_for([EXECUTED_DEC], [REVIEW, actual]), [])
        self.assertTrue(has(errs_for([EXECUTED_DEC], [actual, dict(actual)]), "duplicate ACTUAL review"))
        self.assertTrue(has(errs_for([EXECUTED_DEC], [REVIEW, dict(REVIEW)]), "duplicate COUNTERFACTUAL review"))

    def test_actual_references_superseding_executed_decision(self):
        original = dict(GOOD, owner_decision="PENDING", execution="NOT_EXECUTED")
        executed = dict(GOOD, decision_id="2026-11-09-02", kst="2026-11-09T22:00+09:00", supersedes="2026-11-09-01",
                        owner_decision="APPROVED", execution="EXECUTED", status="ADOPTED",
                        inputs_meta=dict(GOOD["inputs_meta"]))
        cf = dict(REVIEW)  # counterfactual on the original pending decision
        act = dict(REVIEW, decision_id="2026-11-09-02", executed=True, outcome_basis="ACTUAL",
                   execution_evidence="PRIVATE_REF:test001")
        self.assertEqual(errs_for([original, executed], [cf, act]), [])
        wrong = dict(act, decision_id="2026-11-09-01")
        self.assertTrue(has(errs_for([original, executed], [wrong]), "ACTUAL outcome but decision"))

    def test_exact_us_session_enforced(self):
        late = dict(REVIEW, matured_session_date="2026-11-16", asof_kst="2026-11-17T07:00+09:00")
        self.assertTrue(has(errs_for([GOOD], [late]), "is 2026-11-13, not 2026-11-16"))

    def test_us_holiday_skipped(self):
        # decision Wed 2026-11-25 10:00 KST: US T+1 = Wed 11/25, T+2 skips Thanksgiving 11/26 -> Fri 11/27
        dec = dict(GOOD, decision_id="2026-11-25-01", kst="2026-11-25T10:00+09:00", review_at=["T+2"],
                   inputs_meta=dict(GOOD["inputs_meta"], observed_at_kst="2026-11-25T09:00+09:00"))
        root = tempfile.mkdtemp()
        rv = dict(REVIEW, decision_id="2026-11-25-01", horizon="T+2", matured_session_date="2026-11-27",
                  asof_kst="2026-11-28T07:00+09:00")
        self.assertEqual(errs_for([dec], [rv]), [])
        self.assertTrue(has(errs_for([dec], [dict(rv, matured_session_date="2026-11-26")]), "is 2026-11-27"))

    def test_declared_calendar_requires_evidence(self):
        krx = dict(REVIEW, horizon="T+1", market="KRX", matured_session_date="2026-11-09",
                   asof_kst="2026-11-09T16:00+09:00", calendar_basis="DECLARED_WITH_SOURCE")
        self.assertTrue(has(errs_for([GOOD], [krx]), "requires calendar_evidence"))
        blank = dict(krx, calendar_evidence={"source": " ", "checked_by": "", "holidays_skipped": []})
        e = errs_for([GOOD], [blank])
        self.assertTrue(has(e, "calendar_evidence.source must be"))
        self.assertTrue(has(e, "calendar_evidence.checked_by must be"))
        self.assertTrue(has(errs_for([GOOD], [dict(REVIEW, market="KRX")]), "only valid for market=US"))

    def test_unverified_calendar_is_provisional(self):
        prov = dict(REVIEW, calendar_basis="UNVERIFIED", matured_session_date="2026-11-16", asof_kst="2026-11-17T07:00+09:00")
        root = write_tree([GOOD], [prov])
        self.assertEqual(dl.validate_tree(root), [])  # lower bound only, allowed
        sc = dl.scorecard(root)
        self.assertEqual(sc["COUNTERFACTUAL"]["provisional"]["CORRECT"], 1)
        self.assertEqual(sum(sc["COUNTERFACTUAL"]["confirmed"].values()), 0)
        root2 = write_tree([GOOD], [REVIEW])
        self.assertEqual(dl.scorecard(root2)["COUNTERFACTUAL"]["confirmed"]["CORRECT"], 1)
        self.assertEqual(sum(dl.scorecard(root2)["ACTUAL"]["confirmed"].values()), 0)

    def test_invalid_calendar_date_is_structured_error(self):
        bad = dict(REVIEW, matured_session_date="2026-11-99")
        e = errs_for([GOOD], [bad])  # must not raise
        self.assertTrue(has(e, "valid calendar date"))
        ev = dict(REVIEW, calendar_basis="DECLARED_WITH_SOURCE",
                  calendar_evidence={"source": "x", "checked_by": "y", "holidays_skipped": ["2026-02-30"]})
        self.assertTrue(has(errs_for([GOOD], [ev]), "invalid date '2026-02-30'"))


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
