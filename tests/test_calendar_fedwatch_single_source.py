"""Regression: the calendar FedWatch row must be a pure view of fed-watch.json.

Incident 2026-11-12 (Verified Calendar runs 43139966572 / 43144300005 /
43147251304): the daily publisher computed the calendar from its local
settlement-derived FedWatch build (96.7%, history 11-09 86.2%) while the
canonical fed-watch.json merge kept the CME official table (90.9%, history []).
The calendar light refresh then restored the consensus but the calendar merge
kept the stale `previous` 86.2%, so the acceptance contract failed.
"""
import copy
import io
import json
import subprocess
import sys
import tempfile
import unittest
from contextlib import redirect_stdout
from datetime import datetime
from pathlib import Path
from unittest.mock import patch
from zoneinfo import ZoneInfo

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'tools'))
import publish_observatory_data as pub  # noqa: E402

DATA = 'market-observatory/data/'
CAL = DATA + 'economic-calendar.json'
FW = DATA + 'fed-watch.json'

OFFICIAL = {
    'schema': 'JJOONI_FED_WATCH_V1', 'read_only': True, 'contains_account_data': False,
    'source_kind': 'CME_OFFICIAL_PUBLIC_TABLE', 'meeting_date': '2026-12-09',
    'market_data_as_of': '2026-11-10', 'hike_25bp_probability': 0.909,
    'generated_kst': '2026-11-11T09:42:57+09:00', 'history': [],
}
DERIVED = {
    'schema': 'JJOONI_FED_WATCH_V1', 'read_only': True, 'contains_account_data': False,
    'source_kind': None, 'meeting_date': '2026-12-09',
    'market_data_as_of': '2026-11-10', 'hike_25bp_probability': 0.966667,
    'generated_kst': '2026-11-12T10:56:40+09:00',
    'history': [{'trade_date': '2026-11-09', 'hike_25bp_probability': 0.862387},
                {'trade_date': '2026-11-10', 'hike_25bp_probability': 0.966667}],
}


def metric(consensus, previous, previous_date):
    return {'key': 'fedwatch_hike_25bp', 'label': 'CME FedWatch 25bp 인상확률 (2026-11-10 기준)',
            'consensus': consensus, 'previous': previous, 'previous_observed_date': previous_date,
            'actual': None, 'observed_date': '2026-11-10', 'source': 'CME Fed Funds futures settlement-derived',
            'metric_type': 'market_probability_snapshot', 'value_role': 'market_forecast',
            'market_value_status': 'CONSENSUS_AVAILABLE'}


def calendar(fw_metric, generated='2026-11-12T08:12:00+09:00'):
    return {'schema': 'JJOONI_ECONOMIC_CALENDAR_V1', 'generated_kst': generated, 'events': [{
        'country': 'US', 'title': 'FOMC 정책결정', 'datetime_kst': '2026-12-10T04:00+09:00',
        'previous': '4.00%', 'consensus': None, 'actual': None,
        'market_data_source': 'Federal Reserve + CME Fed Funds futures settlement-derived',
        'market_metrics': [{'key': 'fed_rate', 'previous': '4.00%', 'consensus': None, 'actual': None},
                           fw_metric]}]}


def acceptance(cal, fwd):
    """Same FedWatch checks as the Verified Calendar 'Acceptance contract' step."""
    fw_kst = datetime.fromisoformat(fwd['meeting_date'] + 'T14:00:00').replace(
        tzinfo=ZoneInfo('America/New_York')).astimezone(ZoneInfo('Asia/Seoul')).date().isoformat()
    events = cal['events']
    event = next((e for e in events if str(e.get('datetime_kst', '')).startswith(fw_kst)
                  and 'FOMC 정책결정' in e['title']), None)
    status = cal.get('fedwatch_metric_status') or {}
    if event is None:
        assert status.get('status') == 'UNAVAILABLE_NO_CALENDAR_EVENT', status
        assert status.get('meeting_date') == fwd['meeting_date'] and status.get('market_data_as_of') == fwd['market_data_as_of'], status
        assert not any(m.get('key') == 'fedwatch_hike_25bp'
                       for e in events for m in (e.get('market_metrics') or [])), 'FedWatch row while UNAVAILABLE'
        assert not any(e.get('fedwatch_as_of') for e in events), 'fedwatch_as_of while UNAVAILABLE'
        return None
    assert status.get('status') != 'UNAVAILABLE_NO_CALENDAR_EVENT', status
    fw = next((m for m in event['market_metrics'] if m.get('key') == 'fedwatch_hike_25bp'), None)
    assert fw and fw['metric_type'] == 'market_probability_snapshot', fw
    assert fw['observed_date'] == fwd['market_data_as_of'], fw
    assert fw['consensus'] == f"{float(fwd['hike_25bp_probability']) * 100:.1f}%", fw
    assert fw['actual'] is None, fw
    hist = sorted((x for x in fwd.get('history') or [] if x.get('trade_date') and
                   x['trade_date'] <= fwd['market_data_as_of'] and x.get('hike_25bp_probability') is not None),
                  key=lambda x: x['trade_date'])
    if len(hist) >= 2:
        assert fw['previous'] == f"{float(hist[-2]['hike_25bp_probability']) * 100:.1f}%", fw
        assert fw['previous_observed_date'] == hist[-2]['trade_date'], fw
    else:
        assert fw['previous'] is None and fw['previous_observed_date'] is None, fw
    assert fw['value_role'] == 'market_forecast', fw
    return fw


def provenance(cal):
    event = cal['events'][0]
    fw = next(m for m in event['market_metrics'] if m.get('key') == 'fedwatch_hike_25bp')
    return fw['source'], fw.get('source_kind'), event['market_data_source']


OFFICIAL_LABEL = 'CME FedWatch official public probability table'
DERIVED_LABEL = 'CME Fed Funds futures settlement-derived'


def put(root, rel, doc):
    path = root / rel
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(pub.serialize(rel, doc), encoding='utf-8')


def read(root, rel):
    return json.loads((root / rel).read_text(encoding='utf-8'))


def git(root, *args):
    return subprocess.run(['git', *args], cwd=root, check=True, capture_output=True, text=True).stdout.strip()


class MaterializeTest(unittest.TestCase):
    def test_stale_previous_is_cleared_when_source_has_no_history(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            put(root, FW, OFFICIAL)
            put(root, CAL, calendar(metric('90.9%', '86.2%', '2026-11-09')))
            with patch.object(pub, 'ROOT', root):
                self.assertTrue(pub.materialize_calendar_fedwatch([CAL]))
            fw = acceptance(read(root, CAL), OFFICIAL)
            self.assertIsNone(fw['previous'])

    def test_previous_comes_from_source_history(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            put(root, FW, DERIVED)
            put(root, CAL, calendar(metric('90.9%', None, None)))
            with patch.object(pub, 'ROOT', root):
                pub.materialize_calendar_fedwatch([CAL])
            fw = acceptance(read(root, CAL), DERIVED)
            self.assertEqual((fw['consensus'], fw['previous']), ('96.7%', '86.2%'))

    def test_other_metrics_untouched_and_idempotent(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            put(root, FW, OFFICIAL)
            put(root, CAL, calendar(metric('96.7%', '86.2%', '2026-11-09')))
            with patch.object(pub, 'ROOT', root):
                pub.materialize_calendar_fedwatch([CAL])
                self.assertFalse(pub.materialize_calendar_fedwatch([CAL]))
            event = read(root, CAL)['events'][0]
            self.assertEqual(event['market_metrics'][0]['key'], 'fed_rate')
            self.assertEqual(sum(m['key'] == 'fedwatch_hike_25bp' for m in event['market_metrics']), 1)

    def test_no_write_when_calendar_not_published(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            put(root, FW, OFFICIAL)
            put(root, CAL, calendar(metric('96.7%', '86.2%', '2026-11-09')))
            before = (root / CAL).read_text()
            with patch.object(pub, 'ROOT', root):
                self.assertFalse(pub.materialize_calendar_fedwatch([FW]))
            self.assertEqual((root / CAL).read_text(), before)


class ProvenanceTest(unittest.TestCase):
    def run_once(self, root, fedwatch, fw_metric):
        put(root, FW, fedwatch)
        put(root, CAL, calendar(fw_metric))
        with patch.object(pub, 'ROOT', root):
            pub.materialize_calendar_fedwatch([CAL])
        return read(root, CAL)

    def test_official_source_kind_labels_official_without_promotion(self):
        with tempfile.TemporaryDirectory() as tmp:
            cal = self.run_once(Path(tmp), OFFICIAL, metric('96.7%', '86.2%', '2026-11-09'))
            src, kind, event_src = provenance(cal)
            self.assertEqual((src, kind), (OFFICIAL_LABEL, 'CME_OFFICIAL_PUBLIC_TABLE'))
            self.assertEqual(event_src, 'Federal Reserve + ' + OFFICIAL_LABEL)
            fw = acceptance(cal, OFFICIAL)  # still market_forecast, actual None
            self.assertEqual(fw['observed_date'], '2026-11-10')

    def test_derived_or_unknown_source_kind_stays_settlement_derived(self):
        for kind in (None, 'SOMETHING_UNVERIFIED'):
            with tempfile.TemporaryDirectory() as tmp:
                fedwatch = dict(DERIVED, source_kind=kind)
                cal = self.run_once(Path(tmp), fedwatch, metric('90.9%', None, None))
                src, got_kind, event_src = provenance(cal)
                self.assertEqual((src, got_kind), (DERIVED_LABEL, kind))
                self.assertEqual(event_src, 'Federal Reserve + ' + DERIVED_LABEL)

    def test_switching_back_and_forth_is_idempotent(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            self.run_once(root, OFFICIAL, metric('96.7%', '86.2%', '2026-11-09'))
            with patch.object(pub, 'ROOT', root):
                put(root, FW, DERIVED); pub.materialize_calendar_fedwatch([CAL])
                put(root, FW, OFFICIAL); pub.materialize_calendar_fedwatch([CAL])
                snapshot = (root / CAL).read_text()
                self.assertFalse(pub.materialize_calendar_fedwatch([CAL]))
            self.assertEqual((root / CAL).read_text(), snapshot)
            self.assertEqual(provenance(read(root, CAL))[2], 'Federal Reserve + ' + OFFICIAL_LABEL)

    def test_meeting_roll_beyond_seed_omits_only_fedwatch(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            rolled = dict(OFFICIAL, meeting_date='2028-01-26', market_data_as_of='2027-12-09')
            put(root, FW, rolled)
            stale = metric('96.7%', '86.2%', '2026-11-09')
            current_on_wrong_event = dict(stale, observed_date='2027-12-09')
            cal = calendar(current_on_wrong_event)
            put(root, CAL, cal)
            out = io.StringIO()
            with patch.object(pub, 'ROOT', root), redirect_stdout(out):
                self.assertTrue(pub.materialize_calendar_fedwatch([CAL]))
            got = read(root, CAL)
            self.assertIn('UNAVAILABLE_NO_CALENDAR_EVENT meeting_date=2028-01-26', out.getvalue())
            self.assertIsNone(acceptance(got, rolled))
            self.assertEqual(got['events'][0]['market_metrics'], [cal['events'][0]['market_metrics'][0]])  # fed_rate kept
            self.assertEqual(got['events'][0]['market_data_source'], 'Federal Reserve')  # FedWatch token only

    def test_roll_invalidates_every_fedwatch_row_and_event_provenance(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            rolled = dict(OFFICIAL, meeting_date='2028-01-26', market_data_as_of='2027-12-09')
            cal = calendar(metric('96.7%', '86.2%', '2026-11-09'))  # old as-of != current
            cal['events'][0]['fedwatch_as_of'] = '2026-11-10'
            cal['events'].append({'country': 'US', 'title': 'FOMC 정책결정', 'datetime_kst': '2027-12-09T04:00+09:00',
                                  'fedwatch_as_of': '2027-11-30',
                                  'market_data_source': 'Federal Reserve + ' + OFFICIAL_LABEL,
                                  'market_metrics': [{'key': 'fed_rate', 'previous': '3.50%'},
                                                     dict(metric('40.0%', None, None), observed_date='2027-11-30')]})
            put(root, FW, rolled); put(root, CAL, cal)
            with patch.object(pub, 'ROOT', root):
                pub.materialize_calendar_fedwatch([CAL])
                again = (root / CAL).read_text()
                self.assertFalse(pub.materialize_calendar_fedwatch([CAL]))  # idempotent
            got = read(root, CAL)
            self.assertEqual((root / CAL).read_text(), again)
            self.assertIsNone(acceptance(got, rolled))
            for event in got['events']:
                self.assertEqual([m['key'] for m in event['market_metrics']], ['fed_rate'])
                self.assertNotIn('fedwatch_as_of', event)
                self.assertEqual(event['market_data_source'], 'Federal Reserve')

    def test_recovers_when_target_event_is_seeded(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            rolled = dict(OFFICIAL, meeting_date='2027-01-27', market_data_as_of='2026-12-10')
            put(root, FW, rolled)
            put(root, CAL, calendar(metric('96.7%', '86.2%', '2026-11-09')))
            with patch.object(pub, 'ROOT', root):
                pub.materialize_calendar_fedwatch([CAL])
                self.assertEqual(read(root, CAL)['fedwatch_metric_status']['status'], 'UNAVAILABLE_NO_CALENDAR_EVENT')
                cal = read(root, CAL)
                cal['events'].append({'country': 'US', 'title': 'FOMC 정책결정', 'datetime_kst': '2027-01-28T04:00+09:00',
                                      'market_metrics': []})
                put(root, CAL, cal)
                pub.materialize_calendar_fedwatch([CAL])
            got = read(root, CAL)
            self.assertNotIn('fedwatch_metric_status', got)
            self.assertEqual(acceptance(got, rolled)['consensus'], '90.9%')

    def test_source_delay_keeps_source_observation_date(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            delayed = dict(OFFICIAL, market_data_as_of='2026-11-06', hike_25bp_probability=0.8)
            put(root, FW, delayed)
            put(root, CAL, calendar(metric('90.9%', None, None)))
            with patch.object(pub, 'ROOT', root):
                pub.materialize_calendar_fedwatch([CAL])
            fw = acceptance(read(root, CAL), delayed)
            self.assertEqual((fw['observed_date'], fw['consensus']), ('2026-11-06', '80.0%'))

    def test_corrupt_inputs_fail_closed_without_writing(self):
        cases = {
            'no meeting_date': (lambda f: f.pop('meeting_date'), None),
            'non-ISO as_of': (lambda f: f.update(market_data_as_of='11/10/2026'), None),
            'meeting before as_of': (lambda f: f.update(meeting_date='2026-11-01'), None),
            'probability not numeric': (lambda f: f.update(hike_25bp_probability='n/a'), None),
            'probability out of range': (lambda f: f.update(hike_25bp_probability=9.09), None),
            'malformed FOMC datetime': (None, lambda c: c['events'][0].update(datetime_kst='TBD')),
            'duplicate same-meeting FOMC': (None, lambda c: c['events'].append(copy.deepcopy(c['events'][0]))),
            'events None': (None, lambda c: c.update(events=None)),
            'events dict': (None, lambda c: c.update(events={'a': 1})),
            'event not object': (None, lambda c: c['events'].append('FOMC')),
            'market_metrics dict': (None, lambda c: c['events'][0].update(market_metrics={'k': 1})),
        }
        for name, (mutate_fw, mutate_cal) in cases.items():
            with self.subTest(name), tempfile.TemporaryDirectory() as tmp:
                root = Path(tmp)
                fw, cal = copy.deepcopy(OFFICIAL), calendar(metric('96.7%', '86.2%', '2026-11-09'))
                if mutate_fw: mutate_fw(fw)
                if mutate_cal: mutate_cal(cal)
                put(root, FW, fw); put(root, CAL, cal)
                before = (root / CAL).read_text()
                with patch.object(pub, 'ROOT', root):
                    with self.assertRaisesRegex(RuntimeError, 'CALENDAR_FEDWATCH_MALFORMED'):
                        pub.materialize_calendar_fedwatch([CAL])
                self.assertEqual((root / CAL).read_text(), before)


    def test_non_object_documents_fail_closed(self):
        for name, fw_doc, cal_doc in (('fedwatch list', [OFFICIAL], calendar(metric('90.9%', None, None))),
                                      ('fedwatch null', None, calendar(metric('90.9%', None, None))),
                                      ('calendar list', OFFICIAL, [1, 2])):
            with self.subTest(name), tempfile.TemporaryDirectory() as tmp:
                root = Path(tmp)
                (root / DATA).mkdir(parents=True)
                (root / FW).write_text(json.dumps(fw_doc)); (root / CAL).write_text(json.dumps(cal_doc))
                with patch.object(pub, 'ROOT', root):
                    with self.assertRaisesRegex(RuntimeError, 'CALENDAR_FEDWATCH_MALFORMED'):
                        pub.materialize_calendar_fedwatch([CAL])


class FomcSeedTest(unittest.TestCase):
    # Federal Reserve press release 2025-09-05 (tentative 2027 schedule), second meeting day.
    FED_2027_SECOND_DAYS = ['2027-01-27', '2027-03-17', '2027-04-28', '2027-06-09',
                            '2027-07-28', '2027-09-15', '2027-10-27', '2027-12-08']

    def test_2027_seed_is_fed_statement_time_in_kst(self):
        import calendar_market_events as cme
        expected = [datetime.fromisoformat(d + 'T14:00:00').replace(tzinfo=ZoneInfo('America/New_York'))
                    .astimezone(ZoneInfo('Asia/Seoul')).strftime('%Y-%m-%dT%H:%M+09:00')
                    for d in self.FED_2027_SECOND_DAYS]
        self.assertEqual(cme.FOMC_2027_KST, expected)
        self.assertEqual(cme.FOMC_KST, cme.FOMC_2026_KST + cme.FOMC_2027_KST)
        self.assertEqual(cme.FOMC_KST, sorted(cme.FOMC_KST))

    def test_dec_2026_to_jan_2027_roll_attaches_to_seeded_event(self):
        import calendar_market_events as cme
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            cal = {'schema': 'JJOONI_ECONOMIC_CALENDAR_V1', 'events': [
                {'country': 'US', 'title': 'FOMC 정책결정', 'datetime_kst': dt, 'market_metrics': []}
                for dt in cme.FOMC_KST]}
            cal['events'][7]['market_metrics'] = [metric('96.7%', '86.2%', '2026-11-09')]  # Dec 2026 meeting
            rolled = dict(OFFICIAL, meeting_date='2027-01-27', market_data_as_of='2026-12-10',
                          hike_25bp_probability=0.25, history=[
                              {'trade_date': '2026-12-09', 'hike_25bp_probability': 0.3},
                              {'trade_date': '2026-12-10', 'hike_25bp_probability': 0.25}])
            put(root, FW, rolled); put(root, CAL, cal)
            with patch.object(pub, 'ROOT', root):
                pub.materialize_calendar_fedwatch([CAL])
            got = read(root, CAL)
            fw = acceptance(got, rolled)
            self.assertEqual((fw['consensus'], fw['previous']), ('25.0%', '30.0%'))
            jan = next(e for e in got['events'] if e['datetime_kst'] == '2027-01-28T04:00+09:00')
            self.assertIn(fw, jan['market_metrics'])
            self.assertNotIn('fedwatch_metric_status', got)


class RealGitPublicationTest(unittest.TestCase):
    def _repo(self, tmp):
        root = Path(tmp)
        bare, remote, local = root / 'remote.git', root / 'producer', root / 'daily'
        subprocess.run(['git', 'init', '--bare', str(bare)], check=True, capture_output=True)
        subprocess.run(['git', 'clone', str(bare), str(remote)], check=True, capture_output=True)
        for r in (remote,):
            git(r, 'config', 'user.name', 'Regression'); git(r, 'config', 'user.email', 'r@example.test')
        git(remote, 'checkout', '-b', 'main')
        put(remote, FW, OFFICIAL)
        put(remote, CAL, calendar(metric('90.9%', None, None)))
        git(remote, 'add', '.'); git(remote, 'commit', '-m', 'base'); git(remote, 'push', 'origin', 'main')
        subprocess.run(['git', 'clone', '-b', 'main', str(bare), str(local)], check=True, capture_output=True)
        git(local, 'config', 'user.name', 'Regression'); git(local, 'config', 'user.email', 'r@example.test')
        return bare, remote, local

    def test_daily_publish_whose_fedwatch_loses_merge_keeps_calendar_on_source(self):
        # 10:57 KST case: local derived build loses fed-watch.json to the official table.
        with tempfile.TemporaryDirectory() as tmp:
            bare, remote, local = self._repo(tmp)
            put(local, FW, DERIVED)
            put(local, CAL, calendar(metric('96.7%', '86.2%', '2026-11-09'), '2026-11-12T10:56:49+09:00'))
            with patch.object(pub, 'ROOT', local):
                pub.publish([FW, CAL], 'daily')
            published_fw = json.loads(git(bare, 'show', 'main:' + FW))
            published_cal = json.loads(git(bare, 'show', 'main:' + CAL))
            self.assertEqual(published_fw['source_kind'], 'CME_OFFICIAL_PUBLIC_TABLE')
            fw = acceptance(published_cal, published_fw)
            self.assertEqual((fw['consensus'], fw['previous']), ('90.9%', None))

    def test_calendar_only_refresh_cannot_resurrect_stale_previous(self):
        # 11:13 KST case: main calendar already carries 86.2%; calendar merge retains it.
        with tempfile.TemporaryDirectory() as tmp:
            bare, remote, local = self._repo(tmp)
            put(remote, CAL, calendar(metric('96.7%', '86.2%', '2026-11-09'), '2026-11-12T10:56:49+09:00'))
            git(remote, 'commit', '-am', 'daily stale'); git(remote, 'push', 'origin', 'main')
            git(local, 'pull', '-q', 'origin', 'main')
            put(local, CAL, calendar(metric('90.9%', None, None), '2026-11-12T11:13:18+09:00'))
            with patch.object(pub, 'ROOT', local):
                pub.publish([CAL], 'calendar light refresh')
            published_cal = json.loads(git(bare, 'show', 'main:' + CAL))
            fw = acceptance(published_cal, json.loads(git(bare, 'show', 'main:' + FW)))
            self.assertIsNone(fw['previous'])


    def _remote_calendar_unchanged_on(self, local_fw, local_cal, label):
        with tempfile.TemporaryDirectory() as tmp:
            bare, remote, local = self._repo(tmp)
            remote_before = git(bare, 'show', 'main:' + CAL)
            head_before = git(bare, 'rev-parse', 'main')
            put(local, FW, local_fw)
            put(local, CAL, local_cal)
            with patch.object(pub, 'ROOT', local):
                with self.assertRaisesRegex(RuntimeError, 'CALENDAR_FEDWATCH_MALFORMED'):
                    pub.publish([FW, CAL], label)
            self.assertEqual(git(bare, 'rev-parse', 'main'), head_before, label)
            self.assertEqual(git(bare, 'show', 'main:' + CAL), remote_before, label)

    def test_meeting_roll_beyond_seed_publishes_calendar_without_fedwatch_row(self):
        with tempfile.TemporaryDirectory() as tmp:
            bare, remote, local = self._repo(tmp)
            rolled = dict(OFFICIAL, meeting_date='2028-01-26', market_data_as_of='2027-12-09',
                          generated_kst='2027-12-10T09:00:00+09:00')
            put(local, FW, rolled)
            cal = calendar(metric('96.7%', '86.2%', '2026-11-09'), '2027-12-10T09:01:00+09:00')
            cal['events'][0]['market_metrics'][0]['previous'] = '3.75%'  # unrelated indicator update
            put(local, CAL, cal)
            with patch.object(pub, 'ROOT', local):
                pub.publish([FW, CAL], 'daily after roll')
            published_cal = json.loads(git(bare, 'show', 'main:' + CAL))
            self.assertIsNone(acceptance(published_cal, json.loads(git(bare, 'show', 'main:' + FW))))
            self.assertEqual(published_cal['events'][0]['market_metrics'][0]['previous'], '3.75%')
            self.assertEqual(git(bare, 'log', '-1', '--format=%s', 'main'), 'daily after roll')

    def test_roll_removes_old_remote_fedwatch_row_then_recovers_without_duplicates(self):
        with tempfile.TemporaryDirectory() as tmp:
            bare, remote, local = self._repo(tmp)
            old = calendar(metric('96.7%', '86.2%', '2026-11-09'), '2026-11-12T10:56:49+09:00')
            old['events'][0]['fedwatch_as_of'] = '2026-11-10'
            old['events'][0]['market_metrics'][1]['observed_date'] = '2026-11-09'  # != current as-of
            put(remote, CAL, old); git(remote, 'commit', '-am', 'old row'); git(remote, 'push', 'origin', 'main')
            git(local, 'pull', '-q', 'origin', 'main')
            rolled = dict(OFFICIAL, meeting_date='2028-01-26', market_data_as_of='2027-12-09',
                          generated_kst='2027-12-10T09:00:00+09:00')
            put(local, FW, rolled)
            put(local, CAL, calendar(metric('96.7%', '86.2%', '2026-11-09'), '2027-12-10T09:01:00+09:00'))
            with patch.object(pub, 'ROOT', local):
                pub.publish([FW, CAL], 'daily after roll')
            remote_cal = json.loads(git(bare, 'show', 'main:' + CAL))
            self.assertIsNone(acceptance(remote_cal, json.loads(git(bare, 'show', 'main:' + FW))))
            self.assertFalse(any(m['key'] == 'fedwatch_hike_25bp' for e in remote_cal['events'] for m in e['market_metrics']))
            # Recovery: the next meeting is seeded; FedWatch reappears exactly once.
            seeded = json.loads((local / CAL).read_text())
            seeded['generated_kst'] = '2027-12-11T09:00:00+09:00'
            seeded['events'].append({'country': 'US', 'title': 'FOMC 정책결정',
                                     'datetime_kst': '2028-01-27T04:00+09:00', 'market_metrics': []})
            put(local, CAL, seeded)
            with patch.object(pub, 'ROOT', local):
                pub.publish([CAL], 'seed 2028')
            remote_cal = json.loads(git(bare, 'show', 'main:' + CAL))
            self.assertNotIn('fedwatch_metric_status', remote_cal)
            rows = [(e['datetime_kst'], m) for e in remote_cal['events'] for m in e['market_metrics']
                    if m['key'] == 'fedwatch_hike_25bp']
            self.assertEqual([dt for dt, _ in rows], ['2028-01-27T04:00+09:00'])
            self.assertEqual(acceptance(remote_cal, rolled)['observed_date'], '2027-12-09')

    def test_malformed_fomc_event_blocks_calendar_publication(self):
        broken = calendar(metric('96.7%', '86.2%', '2026-11-09'))
        broken['events'][0]['datetime_kst'] = 'TBD'
        self._remote_calendar_unchanged_on(dict(OFFICIAL, generated_kst='2026-11-12T12:00:00+09:00'),
                                           broken, 'malformed event')

    def test_malformed_fedwatch_blocks_calendar_publication(self):
        bad = {k: v for k, v in OFFICIAL.items() if k != 'meeting_date'}
        bad['generated_kst'] = '2026-11-12T12:00:00+09:00'
        bad['market_data_as_of'] = '2026-11-11'
        self._remote_calendar_unchanged_on(bad, calendar(metric('96.7%', '86.2%', '2026-11-09')), 'malformed fedwatch')

    def test_non_calendar_publication_unaffected_by_corrupt_calendar(self):
        with tempfile.TemporaryDirectory() as tmp:
            bare, remote, local = self._repo(tmp)
            broken = calendar(metric('96.7%', '86.2%', '2026-11-09'))
            broken['events'][0]['datetime_kst'] = 'TBD'
            put(local, CAL, broken)  # present on disk but not part of this publication
            rolled = dict(OFFICIAL, meeting_date='2027-01-27', market_data_as_of='2026-12-10',
                          generated_kst='2026-12-11T09:00:00+09:00')
            put(local, FW, rolled)
            with patch.object(pub, 'ROOT', local):
                pub.publish([FW], 'fedwatch only')
            self.assertEqual(json.loads(git(bare, 'show', 'main:' + FW))['meeting_date'], '2027-01-27')
            self.assertEqual(git(bare, 'log', '-1', '--format=%s', 'main'), 'fedwatch only')


if __name__ == '__main__':
    unittest.main()
