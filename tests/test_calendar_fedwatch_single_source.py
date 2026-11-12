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
    event = next(e for e in cal['events'] if e['datetime_kst'].startswith(fw_kst) and 'FOMC 정책결정' in e['title'])
    fw = next(m for m in event['market_metrics'] if m.get('key') == 'fedwatch_hike_25bp')
    assert fw['metric_type'] == 'market_probability_snapshot', fw
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

    def test_missing_target_is_reported_and_rejected_by_acceptance(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            put(root, FW, dict(OFFICIAL, meeting_date='2027-01-27'))
            put(root, CAL, calendar(metric('96.7%', '86.2%', '2026-11-09')))
            before = (root / CAL).read_text()
            out = io.StringIO()
            with patch.object(pub, 'ROOT', root), redirect_stdout(out):
                self.assertFalse(pub.materialize_calendar_fedwatch([CAL]))
            self.assertIn('CALENDAR_FEDWATCH_REDERIVE=NO_TARGET meeting_date=2027-01-27', out.getvalue())
            self.assertEqual((root / CAL).read_text(), before)
            with self.assertRaises(StopIteration):  # acceptance fails closed
                acceptance(read(root, CAL), dict(OFFICIAL, meeting_date='2027-01-27'))


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


if __name__ == '__main__':
    unittest.main()
