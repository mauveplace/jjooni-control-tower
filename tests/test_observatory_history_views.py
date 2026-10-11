import hashlib
import json
import sys
import tempfile
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'tools'))
from observatory_history_views import archive_pulse, write_calendar_views
from publish_observatory_data import merge_generated


class HistoryViewsTest(unittest.TestCase):
    def test_index_resolves_exact_shard_and_preserves_nulls(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            data = root / 'market-observatory/data'
            data.mkdir(parents=True)
            history = {'series': {'US::x': {'count': 1, 'rows': [{'date': '2026-01-01', 'actual': None}]}}}
            (data / 'economic-calendar-history.json').write_text(json.dumps(history))
            paths = write_calendar_views(root)
            index = json.loads((data / 'calendar-history-index.json').read_bytes())
            item = index['series']['US::x']
            self.assertNotIn('rows', item)
            raw = (data / item['path']).read_bytes()
            self.assertEqual(hashlib.sha256(raw).hexdigest(), item['sha256'])
            self.assertIsNone(json.loads(raw)['bucket']['rows'][0]['actual'])
            self.assertEqual(len(paths), 2)

    def test_same_day_pulse_revisions_are_immutable_and_deduplicated(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            data = root / 'market-observatory/data'
            data.mkdir(parents=True)
            pulse = {'market_date_us': '2026-10-09', 'generated_kst': '2026-10-10T05:10:00+09:00', 'raw': {'score': 47}, 'history': []}
            target = data / 'daily-market-pulse.json'
            target.write_text(json.dumps(pulse))
            first = archive_pulse(root)[0]
            original = first.read_bytes()
            archive_pulse(root)
            pulse['raw']['score'] = 48
            target.write_text(json.dumps(pulse))
            second = archive_pulse(root)[0]
            self.assertNotEqual(first, second)
            self.assertEqual(first.read_bytes(), original)
            index = json.loads((data / 'pulse-history/index.json').read_bytes())
            self.assertEqual(len(index['observations']), 2)

    def test_concurrent_pulse_indices_keep_both_observations(self):
        path = 'market-observatory/data/pulse-history/index.json'
        merged = merge_generated(path, {'observations': [{'snapshot_id': 'a'}]}, {'observations': [{'snapshot_id': 'b'}]})
        self.assertEqual({r['snapshot_id'] for r in merged['observations']}, {'a', 'b'})


if __name__ == '__main__':
    unittest.main()
