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
          "## ② 시장 한눈에\n"
          "| 자산 | 종가·수준 | 검증상태 |\n"
          "|---|---:|---|\n"
          "| NDX | 27,943.74 | 원장 참고 |\n"
          "| SOX | 10,146.32 | Yahoo 참고 |\n"
          "| VIX10 | 20.73 | 원장 참고 |\n"
          "| MA250 | 27,505.80 | 원장 참고 |\n"
          "| DD52W | -10.51% | 원장 참고 |\n"
          "## ③ 핵심 이슈 깊이 읽기\n"
          "## ④ 글로벌·한국 시장\n"
          "**섹터 로테이션·자금흐름**\n"
          "PROXY_ONLY · 실제 ETF 순유입 확인 불가 (발행기관 자료 미확인)\n"
          "| 섹터 | 1D | 5D | ETF 실제 순유입 |\n"
          "| 반도체 | 미확인 | 미확인 | 직접 공시 미확인 |\n"
          "## ⑤ AI 산업·기업실적\n"
          "**주요 기업 실적·가이던스**\n"
          "NO_NEW_RELEASES · 최근 7거래일 이슈 별도 점검, 새로운 공식 공시 없음\n"
          "## ⑥ 주요 일정\n"
          "## ⑦ 투자전략·위험점검·복기\n"
          "**실적×자금흐름 종합판정**\n"
          "실적 자료가 없어 독립적인 섹터 자금 로테이션 판단은 보류\n"
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
        d["body_markdown"]=d["body_markdown"].replace("| SOX | 10,146.32 | Yahoo 참고 |",
         "| SOX | 미확인: Yahoo same-session unavailable | 원천 결측 |")
        validate_dual_market_template(d,c)
        del c["market_metrics"]["SOX"]["reason"]
        with self.assertRaisesRegex(AssertionError,"METRIC_UNVERIFIED_REASON"):
            validate_dual_market_template(d,c)

    def test_roy_review_must_have_repo_bound_exact_comment_and_structured_comparison(self):
        d,c=fixture();r=c["dual_review"];r["review_status"]="REVIEWED"
        with self.assertRaisesRegex(AssertionError,"ROY_EVIDENCE_URL"):
            validate_dual_market_template(d,c)
        r["roy_comment_url"]="https://github.com/other/repo/issues/1#issuecomment-999"
        with self.assertRaisesRegex(AssertionError,"ROY_EVIDENCE_URL"):
            validate_dual_market_template(d,c)
        r["roy_comment_url"]="https://github.com/mauveplace/jjooni-control-tower/pull/459"
        with self.assertRaisesRegex(AssertionError,"ROY_EVIDENCE_URL"):
            validate_dual_market_template(d,c)
        # Syntax of a real GH comment, not an online author authentication test.
        r["roy_comment_url"]="https://github.com/mauveplace/jjooni-control-tower/pull/459#issuecomment-6867212874"
        r["roy_comment_id"]="other"
        with self.assertRaisesRegex(AssertionError,"ROY_EVIDENCE_ID_MISMATCH"):
            validate_dual_market_template(d,c)
        r["roy_comment_id"]="6867212874";r["roy_github_app"]="claude"
        with self.assertRaisesRegex(AssertionError,"ROY_NO_REAL_REPORT"):
            validate_dual_market_template(d,c)
        r["roy_report_status"]="FOUND"
        with self.assertRaisesRegex(AssertionError,"ROY_NO_CLAIM_COMPARISON"):
            validate_dual_market_template(d,c)
        r["comparison"]=[{"metric":"NDX","outcome":"MATCH"}]
        with self.assertRaisesRegex(AssertionError,"ROY_COMPARISON_CLAIM"):
            validate_dual_market_template(d,c)
        r["comparison"]=[{"claim":"NDX latest session close","outcome":"MATCH","session_date":MARKET_DAY,
            "roy_source":"https://github.com/mauveplace/jjooni-control-tower/issues/458",
            "jjooni_source":"https://github.com/mauveplace/jjooni-control-tower/blob/main/market-observatory/data/morning-brief/latest.json",
            "source_independent":False}]
        validate_dual_market_template(d,c)

    def test_report_table_numeric_row_cannot_be_blank_when_json_has_valid_price(self):
        d,c=fixture()
        d["body_markdown"]=d["body_markdown"].replace(
           "| SOX | 10,146.32 | Yahoo 참고 |", "| SOX | 자료 미확인 | 공식 EOD 대기 |")
        with self.assertRaisesRegex(AssertionError,"CORE_MARKET_TABLE_VALUE_MISMATCH"):
            validate_dual_market_template(d,c)

    def test_derived_indicator_must_never_assert_official_close(self):
        d,c=fixture();c["market_metrics"]["VIX10"].update(
            status="OFFICIAL_VERIFIED",official_eod_verified=True)
        with self.assertRaisesRegex(AssertionError,"METRIC_DERIVED_NOT_OFFICIAL"):
            validate_dual_market_template(d,c)


    def test_no_hiding_core_metrics_and_no_fabricated_dual_review(self):
        d,c=fixture();d["body_markdown"]=d["body_markdown"].replace("VIX10","VIX")
        with self.assertRaisesRegex(AssertionError,"CORE_MARKET_TABLE_ROW"):
            validate_dual_market_template(d,c)
        d,c=fixture();d["body_markdown"]=d["body_markdown"].replace("ROY 검토 대기","검토했음")
        with self.assertRaisesRegex(AssertionError,"DUAL_REVIEW_AUDIT_MISSING"):
            validate_dual_market_template(d,c)

    def test_roy_second_review_blocker_wrong_value_prefix_must_not_pass(self):
        d,c=fixture()
        d["body_markdown"]=d["body_markdown"].replace(
            "| NDX | 27,943.74 | 원장 참고 |",
            "| NDX | 127,943.74 | 원장 참고 |")
        with self.assertRaisesRegex(AssertionError,"CORE_MARKET_TABLE_VALUE_MISMATCH"):
            validate_dual_market_template(d,c)
        d,c=fixture()
        d["body_markdown"]=d["body_markdown"].replace(
            "| DD52W | -10.51% | 원장 참고 |",
            "| DD52W | -10.519% | 원장 참고 |")
        with self.assertRaisesRegex(AssertionError,"CORE_MARKET_TABLE_VALUE_MISMATCH"):
            validate_dual_market_template(d,c)

    def test_roy_second_review_blocker_number_only_in_footnote_does_not_count(self):
        d,c=fixture()
        d["body_markdown"]=d["body_markdown"].replace(
            "| MA250 | 27,505.80 | 원장 참고 |",
            "| MA250 | 자료 미확인 | 참고: 어제 27,505.80 |")
        with self.assertRaisesRegex(AssertionError,"CORE_MARKET_TABLE_VALUE_MISMATCH"):
            validate_dual_market_template(d,c)

    def test_roy_second_review_blocker_missing_row_cannot_show_price(self):
        d,c=fixture()
        m=c["market_metrics"]["SOX"]
        m.update(value=None,status="MISSING",reason="단일 제공자 일봉 수집 실패")
        d["body_markdown"]=d["body_markdown"].replace(
            "| SOX | 10,146.32 | Yahoo 참고 |",
            "| SOX | 10,146.32 미확인 | 단일 제공자 일봉 수집 실패 |")
        with self.assertRaisesRegex(AssertionError,"CORE_MARKET_TABLE_MISSING"):
            validate_dual_market_template(d,c)
        d,c=fixture()
        m=c["market_metrics"]["SOX"]
        m.update(value=None,status="MISSING",reason="Y")
        d["body_markdown"]=d["body_markdown"].replace(
            "| SOX | 10,146.32 | Yahoo 참고 |", "| SOX | 미확인 | Y |")
        with self.assertRaisesRegex(AssertionError,"CORE_MARKET_MISSING_REASON_TOO_SHORT"):
            validate_dual_market_template(d,c)

    def test_roy_review_anchor_type_must_match_pr_or_issue(self):
        d,c=fixture()
        r=c["dual_review"]
        r.update(review_status="REVIEWED",roy_report_status="FOUND",
                 roy_comment_url="https://github.com/mauveplace/jjooni-control-tower/issues/461#pullrequestreview-6867365807",
                 roy_comment_id="6867365807",roy_github_app="claude",
                 comparison=[{"claim":"PPI", "outcome":"MATCH","session_date":MARKET_DAY,
                    "roy_source":"https://www.bls.gov/news.release/archives/ppi_11132026.htm",
                    "jjooni_source":"https://github.com/mauveplace/jjooni-control-tower/blob/main/market-observatory/data/morning-brief/latest.json",
                    "source_independent":True}])
        with self.assertRaisesRegex(AssertionError,"ROY_EVIDENCE_URL"):
            validate_dual_market_template(d,c)

    def test_roy_unverified_common_cannot_be_marked_independent(self):
        d,c=fixture();r=c["dual_review"]
        r.update(review_status="REVIEWED",roy_report_status="FOUND",
                 roy_comment_url="https://github.com/mauveplace/jjooni-control-tower/pull/459#issuecomment-6867365807",
                 roy_comment_id="6867365807",roy_github_app="claude",
                 verified_by_independent_provider=True,
                 comparison=[{"claim":"NDX", "outcome":"MATCH","session_date":MARKET_DAY,
                    "roy_source":"https://finance.yahoo.com/quote/%5ENDX/history/",
                    "jjooni_source":"https://github.com/mauveplace/jjooni-control-tower/blob/main/market-observatory/data/daily-glance.json",
                    "source_independent":False}])
        with self.assertRaisesRegex(AssertionError,"ROY_NO_INDEPENDENT_PRICE_PROOF"):
            validate_dual_market_template(d,c)

    def test_sector_earnings_permanent_sections_must_not_be_omitted(self):
        d,c=fixture()
        d['body_markdown']=d['body_markdown'].replace('**섹터 로테이션·자금흐름**','')
        with self.assertRaisesRegex(AssertionError,'SECTOR_FLOW_SECTION_MISSING'):
            validate_dual_market_template(d,c)
        d,c=fixture()
        d['body_markdown']=d['body_markdown'].replace('**주요 기업 실적·가이던스**','')
        with self.assertRaisesRegex(AssertionError,'EARNINGS_SECTION_MISSING'):
            validate_dual_market_template(d,c)
        d,c=fixture()
        d['body_markdown']=d['body_markdown'].replace('**실적×자금흐름 종합판정**','')
        with self.assertRaisesRegex(AssertionError,'EARNINGS_FLOW_CROSS_SECTION_MISSING'):
            validate_dual_market_template(d,c)

    def test_sector_price_volume_proxy_is_never_evidence_of_direct_fund_inflow(self):
        d,c=fixture()
        d['body_markdown']=d['body_markdown'].replace('PROXY_ONLY','')
        with self.assertRaisesRegex(AssertionError,'SECTOR_FLOW_EVIDENCE_STATUS_MISSING'):
            validate_dual_market_template(d,c)
        d,c=fixture()
        d['body_markdown']=d['body_markdown'].replace(
            'PROXY_ONLY · 실제 ETF 순유입 확인 불가 (발행기관 자료 미확인)',
            'PROXY_ONLY · 가격 상승만 관측')
        with self.assertRaisesRegex(AssertionError,'PROXY_FLOW_LIMIT_MISSING'):
            validate_dual_market_template(d,c)

    def test_direct_flow_claim_requires_defined_quantity_and_evidence(self):
        d,c=fixture()
        d['body_markdown']=d['body_markdown'].replace(
            'PROXY_ONLY · 실제 ETF 순유입 확인 불가 (발행기관 자료 미확인)',
            'DIRECT_VERIFIED · ETF 가격 상승')
        with self.assertRaisesRegex(AssertionError,'DIRECT_FLOW_MEASURE_MISSING'):
            validate_dual_market_template(d,c)
        d,c=fixture()
        d['body_markdown']=d['body_markdown'].replace(
            'PROXY_ONLY · 실제 ETF 순유입 확인 불가 (발행기관 자료 미확인)',
            'DIRECT_VERIFIED · ETF 순설정 금액 확인')
        with self.assertRaisesRegex(AssertionError,'DIRECT_FLOW_SOURCE_MISSING'):
            validate_dual_market_template(d,c)

    def test_earnings_coverage_requires_explicit_release_status(self):
        d,c=fixture()
        d['body_markdown']=d['body_markdown'].replace('NO_NEW_RELEASES','')
        with self.assertRaisesRegex(AssertionError,'EARNINGS_COVERAGE_STATUS_MISSING'):
            validate_dual_market_template(d,c)

    def test_historical_archive_is_not_retroactively_invalidated(self):
        d,c=fixture();d["report_date_kst"]="2026-11-14"
        c.clear()
        validate_dual_market_template(d,c)


if __name__=="__main__":
    unittest.main()
