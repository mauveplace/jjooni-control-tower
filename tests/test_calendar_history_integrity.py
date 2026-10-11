import sys
import unittest
from datetime import datetime, timedelta
from pathlib import Path
from zoneinfo import ZoneInfo

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'tools'))
from build_calendar_history import add_series
from calendar_history_integrity import merge_history_observation, merge_history_documents
import backfill_calendar_history_forexfactory as ff


class HistoryIntegrityTest(unittest.TestCase):
    def test_daily_writer_preserves_official_actual_and_provenance(self):
        series = {}
        old = dict(date='2026-01-01', metric_key='x', actual='3.0%', source='BLS', source_tier='OFFICIAL')
        new = dict(old, actual='3.1%', source='Feed', source_tier='MARKET_FEED', consensus='3.2%', surprise='-0.1')
        add_series(series, 'x', {}, old)
        add_series(series, 'x', {}, new)
        row = series['x']['rows'][0]
        self.assertEqual((row['actual'], row['source'], row['source_tier']), ('3.0%', 'BLS', 'OFFICIAL'))
        self.assertEqual(row['consensus'], '3.2%')
        self.assertEqual(row['consensus_source'], 'Feed')
        self.assertNotIn('surprise', row)
        self.assertFalse(row['revisions'][0]['accepted'])

    def test_revised_value_cannot_replace_as_released(self):
        old = dict(actual='1', source_tier='OFFICIAL', value_vintage='AS_RELEASED')
        new = dict(actual='2', source_tier='OFFICIAL', value_vintage='LATEST_REVISION')
        self.assertEqual(merge_history_observation(old, new)['actual'], '1')

    def test_older_official_observation_cannot_regress_newer(self):
        old = dict(actual='2', source_tier='OFFICIAL', checked_kst='2026-01-02')
        new = dict(actual='1', source_tier='OFFICIAL', checked_kst='2026-01-01')
        self.assertEqual(merge_history_observation(old, new)['actual'], '2')

    def test_official_upgrade_and_null_preservation(self):
        old = dict(actual='1', source_tier='MARKET_FEED', consensus='2')
        new = dict(actual='3', source_tier='OFFICIAL', consensus=None)
        row = merge_history_observation(old, new)
        self.assertEqual((row['actual'], row['consensus']), ('3', '2'))

    def test_publication_unions_rows_without_regressing_actual(self):
        remote = {'series': {'x': {'rows': [dict(date='2026-01-01', actual='3', source_tier='OFFICIAL')]}}}
        local = {'series': {'x': {'rows': [dict(date='2026-01-01', actual='9', source_tier='MARKET_FEED'), dict(date='2026-01-02', actual='4')]}}}
        result = merge_history_documents(local, remote)
        self.assertEqual(result['row_count'], 2)
        self.assertEqual(result['series']['x']['rows'][0]['actual'], '3')

    def test_recent_segment_requested_despite_full_old_boundary(self):
        today = datetime.now(ZoneInfo('Asia/Seoul')).date()
        start = today - timedelta(days=3650)
        weeks = ff.target_weeks(start, start.isoformat())
        self.assertIn(ff.sunday_on_or_before(today - timedelta(days=100)), weeks)
        self.assertIn(ff.sunday_on_or_before(today), weeks)

    def test_completed_recent_weeks_skipped_but_current_revisited(self):
        today = datetime.now(ZoneInfo('Asia/Seoul')).date()
        start = today - timedelta(days=3650)
        recent = ff.target_weeks(start, start.isoformat())
        closed = [w.isoformat() for w in recent if w < ff.sunday_on_or_before(today)]
        self.assertEqual(ff.target_weeks(start, start.isoformat(), recent_completed=closed), [ff.sunday_on_or_before(today)])

    def test_nfp_alias_is_explicit_and_country_scoped(self):
        catalog = {'metric': [dict(ref='US::jobs::nfp', country='US', label='Nonfarm Payrolls', metric_key='nfp')], 'event': []}
        match = ff.best_catalog_match(dict(country='US', title='Non-Farm Employment Change'), catalog)
        self.assertEqual(match['ref'], 'US::jobs::nfp')
        self.assertIsNone(ff.best_catalog_match(dict(country='CA', title='Non-Farm Employment Change'), catalog))


if __name__ == '__main__':
    unittest.main()
