"""ROY×JJOONI daily brief template v2 must detect stale, unsupported and false claims."""
import copy
import sys
import unittest
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parents[1]/"tools"))
from validate_morning_brief import validate_dual_market_template

MARKET_DAY="2026-11-13"
def fixture():
    body=("## ① 오늘의 시장 이야기\n가상 예제\n"
          "## ② 시장 한눈에\n| NDX | SOX | VIX10 | MA250 | DD |\n"
          "## ③ 핵심 이슈 깊이 읽기\n"
          "## ④ 글로벌·한국 시장\n"
          "## ⑤ AI 산업·기업실적\n"
          "## ⑥ 주요 일정\n"
          "## ⑦ 투자전략·위험점검·복기\n"
          "## ⑧ 원천·데이터 감사\nROY 검토 대기")
    day={"report_date_kst":"2026-11-15","market_date_us":MARKET_DAY,
         "body_markdown":body,
         "editorial_contract":{"verified_at_kst":"2026-11-15T06:55:00+09:00"}}
    metrics={}
    for k,v in {"NDX":27943.7363,"SOX":10146.3232,"VIX10":20.73,
                "MA250":27505.8,"DD52W":-10.51}.items():
        metrics[k]={"value":v,"status":"PROVIDER_REFERENCE_ONLY",
          "session_date":MARKET_DAY,"source":"single-source canonical as-of",
          "source_generated_kst":"2026-11-14T07:41:26+09:00",
          "official_eod_verified":False,"trade_signal_eligible":False}
    contract={"template_version":"ROY_JJOONI_DAILY_V2","market_metrics":metrics,
       "dual_review":{"review_status":"PENDING","roy_report_status":"NOT_FOUND",
         "reviewed_source_session":MARKET_DAY,
         "verified_by_independent_provider":False,"comparison":[]},
       "close_checks":[{"symbol":"NDX","status":"MISSING"},{"symbol":"SOX","status":"MISSING"}]}
    return day,contract


class DualTemplateV2(unittest.TestCase):
    def test_valid_pending_roy_independent_evidence_never_forced(self):
        d,c=fixture();validate_dual_market_template(d,c)

    def test_missing_metric_or_session_mismatch_is_blocking(self):
        d,c=fixture();del c["market_metrics"]["SOX"]
        with self.assertRaisesRegex(AssertionError,"CORE_MARKET_METRICS_MISSING"):
            validate_dual_market_template(d,c)
        d,c=fixture();c["market_metrics"]["NDX"]["session_date"]="2026-11-12"
        with self.assertRaisesRegex(AssertionError,"METRIC_SESSION"):
            validate_dual_market_template(d,c)

    def test_reference_cannot_claim_official_or_trade(self):
        d,c=fixture();c["market_metrics"]["SOX"]["trade_signal_eligible"]=True
        with self.assertRaisesRegex(AssertionError,"METRIC_TRADE_BOUNDARY"):
            validate_dual_market_template(d,c)
        d,c=fixture();c["market_metrics"]["SOX"]["official_eod_verified"]=True
        with self.assertRaisesRegex(AssertionError,"METRIC_REFERENCE_IS_NOT_OFFICIAL"):
            validate_dual_market_template(d,c)

    def test_missing_provider_value_requires_real_reason(self):
        d,c=fixture();c["market_metrics"]["SOX"].update(value=None,status="MISSING",reason="Yahoo same-session unavailable")
        validate_dual_market_template(d,c)
        del c["market_metrics"]["SOX"]["reason"]
        with self.assertRaisesRegex(AssertionError,"METRIC_UNVERIFIED_REASON"):
            validate_dual_market_template(d,c)

    def test_roy_review_must_provide_real_source_and_comparisons(self):
        d,c=fixture();c["dual_review"]["review_status"]="REVIEWED"
        with self.assertRaisesRegex(AssertionError,"ROY_EVIDENCE_URL"):
            validate_dual_market_template(d,c)
        c["dual_review"]["roy_comment_url"]="https://github.com/mauveplace/jjooni-control-tower/issues/458#issuecomment-999"
        with self.assertRaisesRegex(AssertionError,"ROY_NO_REAL_REPORT"):
            validate_dual_market_template(d,c)
        c["dual_review"]["roy_report_status"]="FOUND"
        with self.assertRaisesRegex(AssertionError,"ROY_NO_CLAIM_COMPARISON"):
            validate_dual_market_template(d,c)
        c["dual_review"]["comparison"]=[{"metric":"NDX","outcome":"MATCH","source_independent":False}]
        validate_dual_market_template(d,c)

    def test_no_hiding_core_metrics_and_no_fabricated_dual_review(self):
        d,c=fixture();d["body_markdown"]=d["body_markdown"].replace("VIX10","VIX")
        with self.assertRaisesRegex(AssertionError,"CORE_MARKET_TABLE_INCOMPLETE"):
            validate_dual_market_template(d,c)
        d,c=fixture();d["body_markdown"]=d["body_markdown"].replace("ROY 검토 대기","검토했음")
        with self.assertRaisesRegex(AssertionError,"DUAL_REVIEW_AUDIT_MISSING"):
            validate_dual_market_template(d,c)

    def test_historical_archive_is_not_retroactively_invalidated(self):
        d,c=fixture();d["report_date_kst"]="2026-11-14"
        c.clear()
        validate_dual_market_template(d,c)


if __name__=="__main__":
    unittest.main()
