import json
import sys
import tempfile
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'tools'))
from archive_fedwatch import archive_snapshot

class FedWatchHistoryTests(unittest.TestCase):
    def snapshot(self, date='2026-10-08', generated='2026-10-10T12:28:27+09:00', probability=1.0):
        return dict(schema='JJOONI_FED_WATCH_V1', market_data_as_of=date,
                    generated_kst=generated, contains_account_data=False, read_only=True,
                    freshness='LAGGING', source='CME settlement-derived',
                    meeting_probability_matrix=[dict(meeting_date='2026-10-28',
                        probabilities={'3.50-3.75':probability,'3.75-4.00':1-probability})])

    def archive(self, data, snapshot):
        (data/'fed-watch.json').write_text(json.dumps(snapshot))
        return archive_snapshot(snapshot, data)

    def test_idempotent_full_snapshot_and_csv(self):
        with tempfile.TemporaryDirectory() as td:
            data=Path(td); snapshot=self.snapshot()
            first=self.archive(data,snapshot)
            second=self.archive(data,snapshot)
            self.assertEqual(first,second)
            self.assertEqual(len(second['entries'][0]['revisions']),1)
            self.assertEqual(json.loads((data/second['entries'][0]['path']).read_text()),snapshot)
            self.assertIn('2026-10-28',(data/'fedwatch-history/probabilities.csv').read_text())

    def test_revisions_preserve_original_and_older_rerun_cannot_replace(self):
        with tempfile.TemporaryDirectory() as td:
            data=Path(td)
            first=self.archive(data,self.snapshot())
            original=first['entries'][0]['path']
            self.archive(data,self.snapshot(generated='2026-10-10T13:00:00+09:00',probability=.8))
            index=self.archive(data,self.snapshot(generated='2026-10-10T11:00:00+09:00',probability=.9))
            row=index['entries'][0]
            self.assertEqual(len(row['revisions']),3)
            self.assertEqual(row['generated_kst'],'2026-10-10T13:00:00+09:00')
            self.assertEqual(json.loads((data/original).read_text())['meeting_probability_matrix'][0]['probabilities']['3.50-3.75'],1)

    def test_new_day_keeps_old_day_and_private_payload_is_rejected(self):
        with tempfile.TemporaryDirectory() as td:
            data=Path(td)
            self.archive(data,self.snapshot())
            index=self.archive(data,self.snapshot(date='2026-10-09'))
            self.assertEqual([r['market_data_as_of'] for r in index['entries']],['2026-10-09','2026-10-08'])
            private={**self.snapshot(),'contains_account_data':True}
            with self.assertRaises(ValueError):archive_snapshot(private,data)

if __name__=='__main__':unittest.main()
