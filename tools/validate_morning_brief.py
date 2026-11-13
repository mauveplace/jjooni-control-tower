#!/usr/bin/env python3
"""Validate the published morning brief and its dated archive without market estimation."""
from __future__ import annotations
import argparse
import json
import re
from datetime import date, datetime, timedelta, time
from zoneinfo import ZoneInfo
from pathlib import Path
from urllib.parse import urlparse
from observatory_session import expected_completed_session

EDITORIAL_SECTIONS = [
    '① 오늘의 시장 이야기', '② 시장 한눈에', '③ 핵심 이슈 깊이 읽기',
    '④ 글로벌·한국 시장', '⑤ AI 산업·기업실적', '⑥ 주요 일정',
    '⑦ 투자전략·위험점검·복기', '⑧ 원천·데이터 감사',
]


# New-publication-only quality gate. Historical originally published reports are
# immutable evidence and must not fail just because the template improved.
DUAL_REVIEW_FROM = '2026-11-15'
CORE_MARKET_FIELDS = ('NDX', 'SOX', 'VIX10', 'MA250', 'DD52W')
STATUS_VALUES = {'OFFICIAL_VERIFIED', 'PROVIDER_REFERENCE_ONLY', 'MISSING', 'CONFLICT'}
DUAL_REVIEW_VALUES = {'PENDING', 'REVIEWED', 'BLOCKED', 'UNAVAILABLE'}
ROY_COMPARISON_OUTCOMES = {'MATCH', 'CONFLICT', 'COMPLEMENT', 'UNVERIFIED', 'INCOMPARABLE'}


def validate_dual_market_template(d, contract):
    if d['report_date_kst'] < DUAL_REVIEW_FROM:
        return
    assert contract.get('template_version') == 'ROY_JJOONI_DAILY_V2', 'DUAL_TEMPLATE_VERSION'
    metrics = contract.get('market_metrics')
    assert isinstance(metrics, dict) and all(k in metrics for k in CORE_MARKET_FIELDS), 'CORE_MARKET_METRICS_MISSING'
    from math import isfinite
    for key in CORE_MARKET_FIELDS:
        m = metrics[key]
        assert isinstance(m, dict) and m.get('status') in STATUS_VALUES, ('METRIC_STATUS', key)
        assert m.get('session_date') == d['market_date_us'], ('METRIC_SESSION', key)
        assert m.get('trade_signal_eligible') is False, ('METRIC_TRADE_BOUNDARY', key)
        v = m.get('value')
        # A derived Yahoo-based VIX10/MA250/DD is not an exchange official EOD.
        if key in ('VIX10', 'MA250', 'DD52W'):
            assert m['status'] != 'OFFICIAL_VERIFIED', ('METRIC_DERIVED_NOT_OFFICIAL', key)
        if m['status'] in {'MISSING', 'CONFLICT'}:
            assert v is None and isinstance(m.get('reason'), str) and m['reason'].strip(), ('METRIC_UNVERIFIED_REASON', key)
        else:
            assert isinstance(v, (float, int)) and not isinstance(v, bool) and isfinite(v), ('METRIC_VALUE', key)
            assert v > 0 if key != 'DD52W' else -100 <= v <= 0, ('METRIC_RANGE', key)
            assert isinstance(m.get('source'), str) and m['source'].strip(), ('METRIC_SOURCE', key)
            t = datetime.fromisoformat(m['source_generated_kst'])
            assert t.tzinfo and t.utcoffset() == timedelta(hours=9), ('METRIC_CLOCK', key)
            assert t <= datetime.fromisoformat(d['editorial_contract']['verified_at_kst']), ('METRIC_AFTER_VERIFICATION', key)
            if m['status'] == 'PROVIDER_REFERENCE_ONLY':
                assert m.get('official_eod_verified') is False, ('METRIC_REFERENCE_IS_NOT_OFFICIAL', key)
            else:
                assert m.get('official_eod_verified') is True, ('METRIC_OFFICIAL_PROOF_MISSING', key)
                if key in ('NDX', 'SOX'):
                    check = next((x for x in contract['close_checks'] if x.get('symbol') == key), {})
                    assert check.get('status') == 'VERIFIED', ('METRIC_OFFICIAL_GATE_NOT_VERIFIED', key)
    review = contract.get('dual_review')
    assert isinstance(review, dict) and review.get('review_status') in DUAL_REVIEW_VALUES, 'DUAL_REVIEW_STATUS'
    assert review.get('roy_report_status') in ('FOUND', 'NOT_FOUND', 'UNVERIFIED'), 'ROY_ARTIFACT_STATUS'
    assert review.get('reviewed_source_session') == d['market_date_us'], 'ROY_SESSION'
    assert review.get('verified_by_independent_provider') in (False, True), 'ROY_PRICE_PROOF_FLAG'
    if review['review_status'] == 'REVIEWED':
        # OFFLINE STRUCTURAL CHECK ONLY. JJOONI MUST independently fetch the
        # issue comment's performed_via_github_app.slug == 'claude' before setting
        # REVIEWED; a GitHub URL string cannot establish comment authorship.
        from urllib.parse import urlparse as _urlparse
        u = _urlparse(str(review.get('roy_comment_url') or ''))
        assert (u.scheme == 'https' and u.hostname == 'github.com'
                and re.fullmatch(r'/mauveplace/jjooni-control-tower/(?:issues|pull)/[0-9]+', u.path)
                and ((re.fullmatch(r'issuecomment-[0-9]+', u.fragment) is not None)
                     or (u.path.startswith('/mauveplace/jjooni-control-tower/pull/')
                         and re.fullmatch(r'pullrequestreview-[0-9]+', u.fragment) is not None))), 'ROY_EVIDENCE_URL'
        comment_id = u.fragment.split('-')[-1]
        assert str(review.get('roy_comment_id') or '') == comment_id, 'ROY_EVIDENCE_ID_MISMATCH'
        assert review.get('roy_github_app') == 'claude', 'ROY_APP_NOT_CONFIRMED'
        assert review.get('roy_report_status') == 'FOUND', 'ROY_NO_REAL_REPORT'
        assert isinstance(review.get('comparison'), list) and review['comparison'], 'ROY_NO_CLAIM_COMPARISON'
        for item in review['comparison']:
            assert isinstance(item, dict), 'ROY_COMPARISON_ITEM'
            assert isinstance(item.get('claim'), str) and item['claim'].strip(), 'ROY_COMPARISON_CLAIM'
            assert item.get('outcome') in ROY_COMPARISON_OUTCOMES, 'ROY_COMPARISON_OUTCOME'
            assert item.get('session_date') == d['market_date_us'], 'ROY_COMPARISON_SESSION'
            for key in ('roy_source', 'jjooni_source'):
                p = _urlparse(str(item.get(key) or ''))
                assert p.scheme == 'https' and p.hostname, ('ROY_COMPARISON_SOURCE', key)
            assert item.get('source_independent') in (True, False), 'ROY_INDEPENDENCE_FLAG'
        if not any(item['source_independent'] is True for item in review['comparison']):
            assert review['verified_by_independent_provider'] is False, 'ROY_NO_INDEPENDENT_PRICE_PROOF'
    body = d['body_markdown']
    assert '## ② 시장 한눈에' in body and '## ③ 핵심 이슈 깊이 읽기' in body, 'CORE_TABLE_SECTION'
    table_part = body.split('## ② 시장 한눈에', 1)[1].split('## ③ 핵심 이슈 깊이 읽기', 1)[0]
    table_rows = []
    for line in table_part.splitlines():
        if line.strip().startswith('|'):
            cells = [x.strip() for x in line.strip().strip('|').split('|')]
            if len(cells) >= 3:
                table_rows.append(cells)
    aliases = {'NDX':('NDX',), 'SOX':('SOX',), 'VIX10':('VIX10',),
               'MA250':('MA250',), 'DD52W':('DD52W','DD 52주','DD(52주)','DD')}
    for key in CORE_MARKET_FIELDS:
        rows = [row for row in table_rows if any(re.search(r'(?<![A-Za-z0-9])' + re.escape(label) + r'(?![A-Za-z0-9])', row[0], re.I)
                for label in aliases[key])]
        assert len(rows) == 1, ('CORE_MARKET_TABLE_ROW', key)
        # Only the PUBLIC LEVEL cell (second column) is authoritative. Do
        # not mistake a number in commentary/status for the displayed price.
        # Require one complete numeric token, never substrings of a larger
        # number (127,943.74 must not match 27,943.74). This also rejects
        # a fabricated MISSING display value, not only numeric JSON mismatch.
        level_cell = rows[0][1]
        status_cells = ' | '.join(rows[0][2:])
        visible = ' | '.join(rows[0][1:])
        price_tokens = re.findall(
            r'(?<![\d.,A-Za-z])[-+]?(?:\d{1,3}(?:,\d{3})+|\d+)(?:\.\d+)?(?![\d.,])',
            level_cell)
        m = metrics[key]
        if m['status'] in {'MISSING', 'CONFLICT'}:
            reason = m['reason']
            assert len(reason.strip()) >= 8, ('CORE_MARKET_MISSING_REASON_TOO_SHORT', key)
            assert (('미확인' in level_cell or '충돌' in level_cell)
                    and reason in visible), ('CORE_MARKET_TABLE_MISSING_REASON', key)
            assert not price_tokens, ('CORE_MARKET_TABLE_MISSING_SHOWS_PRICE', key)
        else:
            numeric = f"{m['value']:,.2f}"
            assert price_tokens == [numeric], ('CORE_MARKET_TABLE_VALUE_MISMATCH', key)
            if m['status'] == 'PROVIDER_REFERENCE_ONLY':
                assert '참고' in visible, ('CORE_MARKET_TABLE_REFERENCE_LABEL', key)
    # V2.1: a numeric ETF move cannot masquerade as verified new cash.
    # Source existence is ultimately checked outside this offline validator.
    import re as _regex
    from urllib.parse import urlparse as _flow_parse
    region_section = body.split('## ④ 글로벌·한국 시장', 1)[1].split('## ⑤ AI 산업·기업실적', 1)[0]
    earnings_section = body.split('## ⑤ AI 산업·기업실적', 1)[1].split('## ⑥ 주요 일정', 1)[0]
    strategy_section = body.split('## ⑦ 투자전략·위험점검·복기', 1)[1].split('## ⑧ 원천·데이터 감사', 1)[0]
    assert '**섹터 로테이션·자금흐름**' in region_section, 'SECTOR_FLOW_SECTION_MISSING'
    assert '**주요 기업 실적·가이던스**' in earnings_section, 'EARNINGS_SECTION_MISSING'
    assert '**실적×자금흐름 종합판정**' in strategy_section, 'EARNINGS_FLOW_CROSS_SECTION_MISSING'

    status_line = _regex.search(
        r'(?m)^\s*(?:[-*]\s*)?(?:\*\*)?(DIRECT_VERIFIED|PROXY_ONLY|UNAVAILABLE)(?:\*\*)?\s*[·:]',
        region_section)
    assert status_line, 'SECTOR_FLOW_EVIDENCE_STATUS_MISSING'
    status = status_line.group(1)
    earnings_line = _regex.search(
        r'(?m)^\s*(?:[-*]\s*)?(?:\*\*)?(REPORTED|NO_NEW_RELEASES|SOURCE_UNAVAILABLE)(?:\*\*)?\s*[·:]',
        earnings_section)
    assert earnings_line, 'EARNINGS_COVERAGE_STATUS_MISSING'
    earnings_status = earnings_line.group(1)
    flow_entries = contract.get('sector_flows')
    assert isinstance(flow_entries, list), 'SECTOR_FLOW_CLAIMS_REQUIRED'
    issuer_events = contract.get('earnings_events')
    assert isinstance(issuer_events, list), 'EARNINGS_EVENTS_REQUIRED'

    def require_url(value, code):
        u = _flow_parse(str(value or ''))
        assert u.scheme == 'https' and bool(u.hostname) and u.hostname not in (
            'example.com', 'localhost', 'test.com'), code

    def time_with_zone(value, code):
        try:
            v = datetime.fromisoformat(str(value or ''))
        except ValueError as ex:
            raise AssertionError(code) from ex
        assert v.tzinfo is not None and v.utcoffset() is not None, code
        return v

    for row in flow_entries:
        assert isinstance(row, dict), 'FLOW_ENTRY_SHAPE'
        assert row.get('measure') in ('creation_redemption', 'investor_net_buy'), 'FLOW_MEASURE_UNRECOGNIZED'
        assert isinstance(row.get('instrument'), str) and row['instrument'].strip(), 'FLOW_INSTRUMENT'
        val = row.get('value')
        assert isinstance(val, (int, float)) and not isinstance(val, bool) and isfinite(val), 'FLOW_VALUE'
        assert row.get('currency') in ('USD','KRW','JPY','EUR','TWD','HKD'), 'FLOW_CURRENCY'
        assert row.get('derived') is False, 'DERIVED_ESTIMATE_NOT_DIRECT_FLOW'
        assert isinstance(row.get('period_start'), str) and isinstance(row.get('period_end'), str), 'FLOW_PERIOD'
        assert _regex.fullmatch(r'\d{4}-\d{2}-\d{2}', row['period_start']), 'FLOW_PERIOD'
        assert _regex.fullmatch(r'\d{4}-\d{2}-\d{2}', row['period_end']), 'FLOW_PERIOD'
        assert row['period_start'] <= row['period_end'], 'FLOW_PERIOD_INVERTED'
        require_url(row.get('source_url'), 'FLOW_SOURCE_URL_REQUIRED')
        time_with_zone(row.get('source_published_at'), 'FLOW_SOURCE_CLOCK_REQUIRED')
    direct_lines = [line.strip() for line in region_section.splitlines()
                    if _regex.search(r'(?<!\w)DIRECT_VERIFIED(?!\w)', line)]
    if status == 'DIRECT_VERIFIED':
        assert flow_entries and direct_lines, 'DIRECT_FLOW_STRUCTURED_EVIDENCE_REQUIRED'
    if status != 'DIRECT_VERIFIED':
        assert not direct_lines and not flow_entries, 'UNVERIFIED_SECTOR_CANNOT_CLAIM_DIRECT_FLOW'
    for line in direct_lines:
        assert any(row['instrument'] in line and row['currency'] in line
                   and f"{row['value']:,.2f}" in line and row['period_end'] in line
                   and row['source_url'] in line for row in flow_entries), 'DIRECT_FLOW_VISIBLE_CLAIM_UNBACKED'

    if status == 'PROXY_ONLY':
        summary = status_line.group(0)
        tail = region_section[status_line.end():].splitlines()[0]
        assert ('확인 불가' in tail or '미확인' in tail), 'PROXY_FLOW_LIMIT_MISSING'
    if status == 'UNAVAILABLE':
        tail = region_section[status_line.end():].splitlines()[0]
        assert any(x in tail for x in ('미확인','자료 없음','확인 불가','원천 지연')), 'FLOW_UNAVAILABLE_REASON_MISSING'

    # Scan ALL content of ④ and ⑦, not just lines with the status word.
    # Genuine asserted new cash movement must have a structured source-backed
    # DIRECT_VERIFIED line. Hypothetical/comparative discussion is allowed
    # only when explicitly qualified as speculation or unconfirmed.
    asserted_flow = _regex.compile(
        r'(?:자금\s*(?:대거\s*)?(?:유입|유출)|순유입액?\s*(?:[+$€₩-]|\d)|'
        r'순매수\s*(?:[+$€₩-]|\d)|(?:inflow|outflow)\s*(?:[+$€₩-]|\d))', _regex.I)
    for block in (region_section, strategy_section):
        for line in block.splitlines():
            if not asserted_flow.search(line):
                continue
            if any(x in line for x in ('추론','가정','가능성','확인 불가','미확인','불명','만약','가설','조건부','UNAVAILABLE','PROXY_ONLY')):
                continue
            assert 'DIRECT_VERIFIED' in line and any(
                row['instrument'] in line and row['currency'] in line
                and f"{row['value']:,.2f}" in line and row['source_url'] in line
                for row in flow_entries), 'UNVERIFIED_FUND_INFLOW_ASSERTION'

    if earnings_status == 'REPORTED':
        assert issuer_events, 'ISSUER_EARNINGS_SOURCE_REQUIRED'
    elif earnings_status == 'NO_NEW_RELEASES':
        assert not issuer_events, 'NO_RELEASES_CONFLICT_WITH_EARNINGS'
    elif earnings_status == 'SOURCE_UNAVAILABLE':
        assert not issuer_events, 'ISSUER_UNAVAILABLE_CANNOT_ASSERT_RELEASE'
    for event in issuer_events:
        assert isinstance(event, dict), 'EARNINGS_EVENT_SHAPE'
        assert isinstance(event.get('issuer'), str) and event['issuer'].strip(), 'EARNINGS_ISSUER'
        assert isinstance(event.get('fiscal_period'), str) and event['fiscal_period'].strip(), 'EARNINGS_PERIOD'
        require_url(event.get('source_url'), 'EARNINGS_ISSUER_URL_REQUIRED')
        time_with_zone(event.get('released_at'), 'EARNINGS_RELEASE_TIME_REQUIRED')
        assert event.get('eps_basis') in ('GAAP', 'NON_GAAP', 'NOT_REPORTED'), 'EARNINGS_EPS_BASIS_REQUIRED'
        assert event.get('consensus_status') in ('PUBLISHED_SOURCE','CONSENSUS_UNAVAILABLE'), 'EARNINGS_CONSENSUS_STATUS'
    if earnings_status == 'REPORTED':
        assert any(event['issuer'] in earnings_section for event in issuer_events), 'EARNINGS_NOT_VISIBLE'
    if earnings_status in ('NO_NEW_RELEASES','SOURCE_UNAVAILABLE'):
        assert any(word in earnings_section for word in ('미확인','발표 없음','신규 공시 없음','접근 불가','조회 불가','자료 없음')), 'EARNINGS_QUIET_DAY_REASON_REQUIRED'
    audit_part = body.split('## ⑧ 원천·데이터 감사', 1)[1]
    assert 'ROY' in audit_part or '로이' in audit_part, 'DUAL_REVIEW_AUDIT_MISSING'

def validate_editorial(d, created):
    """Keep the new daily format and close proof from silently reverting."""
    if d['report_date_kst'] < '2026-11-03':
        return  # Dated historical reports retain their original presentation.
    contract = d.get('editorial_contract') or {}
    assert contract.get('version') == 'SONG_INSPIRED_DAILY_V1', 'EDITORIAL_VERSION'
    body = d['body_markdown']
    assert re.findall(r'^##\s+(.+)$', body, re.M) == EDITORIAL_SECTIONS, 'EDITORIAL_SECTIONS'
    for label in ('핵심 숫자', '무슨 일이 있었나', '왜 중요한가', '반대 해석', '다음 확인'):
        assert body.count('**' + label + ':**') >= 3, ('ISSUE_EXPLANATION_MISSING', label)
    checked = datetime.fromisoformat(contract['verified_at_kst'])
    assert checked.utcoffset() == timedelta(hours=9) and checked <= created, 'VERIFICATION_CLOCK'
    assert d['market_date_us'] <= expected_completed_session(checked), 'UNFINISHED_US_SESSION'
    checks = contract.get('close_checks') or []
    assert {x.get('symbol') for x in checks} == {'NDX', 'SOX'}, 'CORE_CLOSE_COVERAGE'
    # A cited price reference may appear alongside a CONFLICT, but must never
    # change the strict official-close/trading gate.
    references = contract.get('reference_quotes') or []
    assert len(references) <= 2, 'REFERENCE_SCOPE'
    assert len({r.get('symbol') for r in references}) == len(references), 'REFERENCE_DUPLICATES'
    close_by_symbol = {c['symbol']: c for c in checks}
    for ref in references:
        assert ref.get('symbol') in close_by_symbol, 'REFERENCE_SYMBOL'
        assert close_by_symbol[ref['symbol']].get('status') in {'CONFLICT', 'MISSING'}, 'REFERENCE_OFFICIAL_GATE'
        assert ref.get('session_date') == d['market_date_us'], 'REFERENCE_SESSION'
        assert ref.get('status') == 'PROVIDER_REFERENCE_ONLY', 'REFERENCE_STATUS'
        assert ref.get('official_eod_verified') is False and ref.get('trade_signal_eligible') is False, 'REFERENCE_TRADE_BOUNDARY'
        close, previous, pct = ref.get('close'), ref.get('previous_close'), ref.get('change_pct')
        assert all(isinstance(v, (int, float)) and not isinstance(v, bool) and 0 < v < float('inf') for v in (close, previous)), 'REFERENCE_VALUE'
        assert isinstance(pct, (int, float)) and abs((close / previous - 1)*100 - pct) < .015, 'REFERENCE_RETURN'
        official_previous = close_by_symbol[ref['symbol']].get('previous_close')
        assert isinstance(official_previous, (int, float)) and abs(official_previous - previous) <= 0.02, 'REFERENCE_PREVIOUS_CLOSE_MISMATCH'
        checked = datetime.fromisoformat(ref['checked_at_kst'])
        assert checked.utcoffset() == timedelta(hours=9) and checked >= created, 'REFERENCE_CHECK_CLOCK'
        obs = ref.get('source_observations') or []
        assert len(obs) >= 2, 'REFERENCE_SOURCE_COUNT'
        domains = set()
        late_postclose_count = 0
        for item in obs:
            url = item.get('url') or ''
            parsed = urlparse(url)
            assert parsed.scheme == 'https' and parsed.hostname and item.get('session_date') == d['market_date_us'], 'REFERENCE_SOURCE_URL_SESSION'
            observation_close = item.get('close')
            assert isinstance(observation_close, (int, float)) and not isinstance(observation_close, bool) and 0 < observation_close < float('inf') and int(observation_close) == int(close), 'REFERENCE_SOURCE_DISAGREEMENT'
            stamp = datetime.fromisoformat(item['quote_time_et'])
            ny = stamp.astimezone(ZoneInfo('America/New_York'))
            assert stamp.tzinfo and ny.date().isoformat() == d['market_date_us'] and ny.time() >= time(16) and stamp <= checked, 'REFERENCE_NOT_POST_CLOSE'
            if ny.time() >= time(16, 30):
                late_postclose_count += 1
            domains.add(parsed.hostname)
        assert len(domains) >= 2 and late_postclose_count >= 1 and ref.get('limitations'), 'REFERENCE_PROVENANCE'
    validate_dual_market_template(d, contract)
    for check in checks:
        assert check.get('session_date') == d['market_date_us'], 'CLOSE_SESSION_MISMATCH'
        post_audit=check.get('post_publication_verified_at_kst')
        if post_audit:
            revised=datetime.fromisoformat(post_audit)
            assert revised.utcoffset() == timedelta(hours=9) and revised > created, 'POST_PUBLICATION_CLOCK'
            assert contract.get('verification_updated_kst') == post_audit, 'POST_PUBLICATION_VERSION'
            matching=[r for r in d.get('revisions', []) if
                      r.get('field') == 'editorial_contract.close_checks['+check['symbol']+']' and
                      r.get('revised_at_kst') == post_audit and
                      len(set(r.get('source_urls') or [])) >= 2]
            assert matching, 'POST_PUBLICATION_PROOF_TRAIL'
        assert check.get('status') in {'VERIFIED', 'MISSING', 'CONFLICT', 'CROSS_CHECKED'}, 'CLOSE_STATUS'
        if check['status'] == 'CROSS_CHECKED':
            assert check.get('reason') and check.get('official_status') == 'NOT_CHECKED', 'CROSS_CHECK_DISCLOSURE'
            close, previous = check.get('close'), check.get('previous_close')
            assert all(isinstance(v, (int, float)) and 0 < v < float('inf') for v in (close, previous)), 'CLOSE_VALUE'
            assert abs((close / previous - 1) * 100 - check['change_pct']) < .01, 'CLOSE_RETURN_ARITHMETIC'
            observations = check.get('source_observations') or []
            valid = []
            postclose = False
            for obs in observations:
                url = obs.get('url') or ''
                host = urlparse(url).hostname if urlparse(url).scheme == 'https' else None
                if not host or url not in (check.get('source_urls') or []): continue
                if obs.get('session_date') != check['session_date'] or obs.get('close') != close: continue
                if obs.get('observation_type') not in ('COMPLETED_DAILY_BAR','POST_CLOSE_QUOTE'): continue
                observed = obs.get('observed_at')
                if observed:
                    stamp = datetime.fromisoformat(observed)
                    assert stamp.tzinfo and stamp <= checked, 'CROSS_CHECK_CLOCK'
                    ny = stamp.astimezone(ZoneInfo('America/New_York'))
                    if ny.date().isoformat() != check['session_date'] or ny.time() < time(16,0):
                        continue
                    postclose = True
                elif obs.get('observation_type') != 'COMPLETED_DAILY_BAR':
                    continue
                valid.append(host)
            assert len(set(valid)) >= 2 and postclose, 'CROSS_CHECK_SOURCES_OR_SESSION'
            continue
        if check['status'] != 'VERIFIED':
            assert check.get('reason'), 'UNVERIFIED_CLOSE_REASON'
            continue
        close, previous = check['close'], check['previous_close']
        assert all(isinstance(v, (int, float)) and 0 < v < float('inf') for v in (close, previous)), 'CLOSE_VALUE'
        assert abs((close / previous - 1) * 100 - check['change_pct']) < .01, 'CLOSE_RETURN_ARITHMETIC'
        urls = check.get('source_urls') or []
        hosts = {urlparse(u).hostname for u in urls if urlparse(u).scheme == 'https'}
        assert len(hosts) >= 2 and any(h and (h == 'nasdaq.com' or h.endswith('.nasdaq.com')) for h in hosts), 'INDEPENDENT_CLOSE_SOURCES'
        assert check.get('observation_type') == 'REGULAR_SESSION_CLOSE', 'CLOSE_OBSERVATION_TYPE'
    return d

def read(path):
    return json.loads(path.read_text(encoding='utf-8'))

# Future-facing static leak prevention. Historical reports remain unchanged and
# retain their existing append-only correction ledger. This is NOT full DLP.
PUBLIC_PRIVACY_START = '2026-11-10'
PUBLIC_PRIVATE_MARKERS = re.compile(
    r'(?:\bAI_BOARD\b|\bMAIOS\b|\bSONG_DB_[A-Z0-9_]+\b|'
    r'\bdecision[-_ ]gate\b|\bPB[ -]?View\b|\bCT[ ]+(?:LIVE|FRESH|STALE)\b|'
    r'docs\.google\.com/spreadsheets/(?:u/[0-9]+/)?d/|'
    r'drive\.google\.com/drive/folders/|'
    r'(?i:Google[ ]+Drive|Plaud)(?:[ ]*(?:의|에서|내|상|에|가))?[ ]*'
    r'(?:폴더|문서|시트|내부|원본|DB|녹취|파일|계정|연동)|'
    r'구글[ ]*드라이브(?:의|에서|내)?[ ]*(?:폴더|문서|시트|파일|계정|연동)|'
    r'(?:KB증권|토스증권|Toss(?:[ ]*(?:증권|Securities))?|'
    r'키움증권|삼성증권|미래에셋증권|NH투자증권|한국투자증권|'
    r'신한투자증권|하나증권|카카오페이증권|대신증권)'
    r'(?:[ ]*(?:의|을[ ]*통한|를[ ]*통한|에서|내))?[ ]*'
    r'(?:계좌|잔고|account\b|balance\b))',
)


def validate_public_content(d):
    """Reject recognizably internal workflow references in future public prose.

    Keep old dated archives accessible, and retain stronger human/source review:
    natural-language leaks cannot be exhaustively detected with regex.
    """
    if d['report_date_kst'] < PUBLIC_PRIVACY_START:
        return
    fields = ('title', 'verification_note', 'body_markdown')
    for field in fields:
        text = d.get(field) or ''
        if PUBLIC_PRIVATE_MARKERS.search(text):
            raise AssertionError('PUBLIC_INTERNAL_REFERENCE:' + field)


def validate_report(d):
    assert d.get('schema') == 'JJOONI_MORNING_BRIEF_V1', 'BRIEF_SCHEMA'
    assert d.get('read_only') is True and d.get('contains_account_data') is False, 'BRIEF_PUBLIC_BOUNDARY'
    report_day = date.fromisoformat(d['report_date_kst'])
    assert date.fromisoformat(d['market_date_us']) <= report_day, 'MARKET_DATE_AFTER_REPORT'
    created = datetime.fromisoformat(d['generated_kst'])
    published = datetime.fromisoformat(d['published_kst'])
    assert created.utcoffset() == published.utcoffset() == timedelta(hours=9), 'KST_OFFSET'
    assert created.date() == report_day and published >= created, 'REPORT_TIMESTAMPS'
    assert d.get('content_status') in {'USER_PROVIDED_NOT_REVERIFIED', 'WEB_VERIFIED_WITH_DISCLOSED_GAPS'}, 'CONTENT_STATUS'
    assert isinstance(d.get('verification_note'), str) and d['verification_note'].strip(), 'VERIFICATION_NOTE'
    body = d.get('body_markdown')
    assert isinstance(body, str) and 500 <= len(body) <= 200_000, 'BODY_LENGTH'
    sections = re.findall(r'^##\s+([①②③④⑤⑥⑦⑧])', body, re.M)
    assert sections == list('①②③④⑤⑥⑦⑧'), ('EIGHT_SECTIONS', sections)
    assert re.search(r'\[[^\]\n]+\]\(https?://[^\s)]+\)', body), 'SOURCE_LINKS'
    assert '' not in body, 'CHAT_ONLY_CITATION_TOKEN'
    validate_editorial(d, created)
    validate_public_content(d)
    return d

def validate_directory(directory):
    latest = validate_report(read(directory / 'latest.json'))
    index = read(directory / 'index.json')
    assert index.get('schema') == 'JJOONI_MORNING_BRIEF_INDEX_V1', 'INDEX_SCHEMA'
    entries = index.get('entries')
    assert isinstance(entries, list) and entries, 'EMPTY_INDEX'
    days = [e['report_date_kst'] for e in entries]
    assert days == sorted(set(days), reverse=True), 'INDEX_ORDER_OR_DUPLICATE'
    assert latest['report_date_kst'] == days[0], 'LATEST_NOT_MOST_RECENT'
    for entry in entries:
        day = date.fromisoformat(entry['report_date_kst'])
        path = day.strftime('%Y%m%d') + '.json'
        assert entry.get('path') == path, 'ARCHIVE_PATH'
        archived = validate_report(read(directory / path))
        for key in ('report_date_kst', 'market_date_us', 'title', 'generated_kst', 'published_kst'):
            assert archived.get(key) == entry.get(key), ('INDEX_ARCHIVE_MISMATCH', key)
        if entry['report_date_kst'] == latest['report_date_kst']:
            assert archived == latest, 'LATEST_ARCHIVE_MISMATCH'
    print('MORNING_BRIEF_ACCEPTANCE=PASS', 'latest='+latest['report_date_kst'], 'archives='+str(len(entries)))

if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--directory', type=Path, default=Path(__file__).resolve().parents[1] / 'market-observatory' / 'data' / 'morning-brief')
    validate_directory(parser.parse_args().directory)
