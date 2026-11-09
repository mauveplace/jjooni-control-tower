import copy
import json
import sys
import unittest
from pathlib import Path

ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT/'tools'))
from validate_morning_brief import validate_report, validate_public_content

class EditorialAcceptanceTests(unittest.TestCase):
    def setUp(self):
        self.report=json.loads((ROOT/'market-observatory/data/morning-brief/20261103.json').read_text())

    def test_new_format_and_historic_archive_both_remain_readable(self):
        validate_report(self.report)
        validate_report(json.loads((ROOT/'market-observatory/data/morning-brief/20261031.json').read_text()))

    def test_old_layout_cannot_silently_replace_new_report(self):
        self.report.pop('editorial_contract')
        with self.assertRaisesRegex(AssertionError,'EDITORIAL_VERSION'):validate_report(self.report)

    def test_issue_explanation_cannot_be_only_headings_and_tables(self):
        self.report['body_markdown']=self.report['body_markdown'].replace('**반대 해석:**','반대 해석')
        with self.assertRaisesRegex(AssertionError,'ISSUE_EXPLANATION'):validate_report(self.report)

    def test_wrong_previous_close_or_change_is_rejected(self):
        self.report['editorial_contract']['close_checks'][0]['change_pct']=.65
        with self.assertRaisesRegex(AssertionError,'ARITHMETIC'):validate_report(self.report)

    def test_same_site_mirrors_do_not_count_as_independent_proof(self):
        self.report['editorial_contract']['close_checks'][0]['source_urls']=['https://indexes.nasdaq.com/a','https://indexes.nasdaq.com/b']
        with self.assertRaisesRegex(AssertionError,'INDEPENDENT'):validate_report(self.report)

    def test_missing_proof_is_allowed_only_with_disclosed_reason(self):
        check=self.report['editorial_contract']['close_checks'][0]
        check.clear();check.update(symbol='NDX',session_date='2026-11-02',status='MISSING',reason='provider conflict')
        validate_report(self.report)
        check.pop('reason')
        with self.assertRaisesRegex(AssertionError,'REASON'):validate_report(self.report)

    def test_est_0540_cannot_verify_same_day_us_close(self):
        self.report['editorial_contract']['verified_at_kst']='2026-11-03T05:40:00+09:00'
        with self.assertRaisesRegex(AssertionError,'UNFINISHED_US_SESSION'):validate_report(self.report)

    def test_different_market_session_is_rejected(self):
        self.report['editorial_contract']['close_checks'][1]['session_date']='2026-10-30'
        with self.assertRaisesRegex(AssertionError,'SESSION_MISMATCH'):validate_report(self.report)

    def cross_checked(self):
        c=self.report['editorial_contract']['close_checks'][0]
        c.update(status='CROSS_CHECKED',reason='official close not yet checked',official_status='NOT_CHECKED',source_urls=['https://provider-a.example/close','https://provider-b.example/close'])
        c['source_observations']=[
            dict(url=c['source_urls'][0],close=c['close'],session_date=c['session_date'],observed_at=None,observation_type='COMPLETED_DAILY_BAR'),
            dict(url=c['source_urls'][1],close=c['close'],session_date=c['session_date'],observed_at='2026-11-02T16:05:00-05:00',observation_type='POST_CLOSE_QUOTE')]
        return c

    def test_cross_checked_reference_does_not_claim_official(self):
        self.cross_checked()
        validate_report(self.report)

    def test_cross_check_rejects_intraday_or_same_provider(self):
        c=self.cross_checked();c['source_observations'][1]['observed_at']='2026-11-02T15:05:00-05:00'
        with self.assertRaisesRegex(AssertionError,'CROSS_CHECK_SOURCES'):validate_report(self.report)
        c=self.cross_checked();c['source_observations'][1]['url']=c['source_observations'][0]['url']
        with self.assertRaisesRegex(AssertionError,'CROSS_CHECK_SOURCES'):validate_report(self.report)

    def test_cross_check_rejects_conflicting_values_and_false_official_status(self):
        c=self.cross_checked();c['source_observations'][1]['close']+=1
        with self.assertRaisesRegex(AssertionError,'CROSS_CHECK_SOURCES'):validate_report(self.report)
        c=self.cross_checked();c['official_status']='VERIFIED'
        with self.assertRaisesRegex(AssertionError,'CROSS_CHECK_DISCLOSURE'):validate_report(self.report)

    def test_verified_post_publication_close_requires_append_only_audit(self):
        revised=json.loads((ROOT/'market-observatory/data/morning-brief/20261107.json').read_text())
        validate_report(revised)
        close=revised['editorial_contract']['close_checks'][0]
        self.assertEqual((close['status'],close['close'],close['change_pct']),('VERIFIED',26989.99,1.35))
        self.assertEqual(revised['editorial_contract']['close_checks'][1]['close'],9390.25)
        self.assertEqual(revised['editorial_contract']['interpretation_status'],
                         'HISTORIC_NARRATIVE_NOT_RECALCULATED_AFTER_EOD_CORRECTION')
        revised['revisions']=[r for r in revised['revisions'] if r.get('field')!='editorial_contract.close_checks[NDX]']
        with self.assertRaisesRegex(AssertionError,'POST_PUBLICATION_PROOF_TRAIL'):
            validate_report(revised)

    def test_audit_proof_timestamp_cannot_be_backdated_to_original_publication(self):
        revised=json.loads((ROOT/'market-observatory/data/morning-brief/20261107.json').read_text())
        close=revised['editorial_contract']['close_checks'][0]
        close['post_publication_verified_at_kst']='2026-11-07T06:30:00+09:00'
        with self.assertRaisesRegex(AssertionError,'POST_PUBLICATION_CLOCK'):
            validate_report(revised)

    def test_new_public_content_rejects_internal_markers(self):
        base = dict(report_date_kst='2026-11-10', title='시장 데이터', verification_note='공식 원천 검증',
                    body_markdown='미국 나스닥 완료장과 산업 실적의 검증된 분석')
        leaking = [
            '내부 AI_BOARD 링크', 'MAIOS 내부 작업', 'SONG_DB_FACTCHECK 구체 테이블',
            'decision_gate LIMITED', 'PB View 화면', 'CT LIVE 상태',
            'https://docs.google.com/spreadsheets/d/SECRET_PLACEHOLDER',
            'Google Drive 폴더 위치', 'Plaud 내부 자료',
            '토스증권 계좌 보유액', 'KB증권 잔고', 'Toss 계좌 보유 종목',
        ]
        for value in leaking:
            for field in ('title', 'verification_note', 'body_markdown'):
                sample = dict(base, **{field: value})
                with self.subTest(value=value, field=field):
                    with self.assertRaisesRegex(AssertionError, 'PUBLIC_INTERNAL_REFERENCE'):
                        validate_public_content(sample)

    def test_public_privacy_guard_is_forward_only_not_archive_rewrite(self):
        historic = dict(report_date_kst='2026-11-07', title='원본 보관',
                        verification_note='내부 AI_BOARD 인용 포함', body_markdown='CT LIVE')
        validate_public_content(historic)
        future = dict(historic, report_date_kst='2026-11-10')
        with self.assertRaisesRegex(AssertionError, 'PUBLIC_INTERNAL_REFERENCE'):
            validate_public_content(future)

    def test_public_market_data_does_not_trigger_false_private_block(self):
        normal = dict(report_date_kst='2026-11-10', title='미국 완료장 시장 시황',
                      verification_note='NDX 정규장 종가 독립 검증',
                      body_markdown='S&P500과 나스닥100, 주요 증권사 전망, FedWatch, 기업 IR, 글로벌 AI CAPEX')
        validate_public_content(normal)

if __name__=='__main__':unittest.main()
