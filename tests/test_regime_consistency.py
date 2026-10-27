import json
import sys
import tempfile
import unittest
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT/'tools'))
from regime_validity import regime_state
import audit_observatory_data as audit
from observatory_history_views import materialize
class RegimeConsistency(unittest.TestCase):
    def test_audit_uses_the_same_effective_window_evaluator(self):
        regime=json.loads((ROOT/'market-observatory/data/market-regime.json').read_text())
        report=audit.build()
        self.assertEqual(report['file_status']['market_regime']['status'],regime_state(regime))
        self.assertEqual(report['file_status']['market_regime']['monitoring_scope'], 'INVESTMENT_BOARD_REFERENCE_ONLY')
        self.assertFalse(any(x['code'].startswith('MARKET_REGIME_') for x in report['issues']))
        # Other genuine collection problems must still count as warnings/failures.
    def test_publication_updates_only_operational_status_not_report_dates(self):
        with tempfile.TemporaryDirectory() as tmp:
            root=Path(tmp);data=root/'market-observatory/data';data.mkdir(parents=True)
            regime={'status':'SCHEDULED','generated_kst':'2020-01-01','effective_window':{'start_kst':'2020-01-01T00:00:00+09:00','end_kst':'2020-01-02T00:00:00+09:00'}}
            (data/'market-regime.json').write_text(json.dumps(regime))
            paths=materialize(root,[]);out=json.loads((data/'market-regime.json').read_text())
            self.assertEqual(out['status'],'EXPIRED');self.assertEqual(out['declared_status'],'SCHEDULED');self.assertEqual(out['generated_kst'],'2020-01-01');self.assertIn('market-observatory/data/market-regime.json',paths)
    def test_ai_read_contract_requires_validity_and_consensus_reads(self):
        contract=json.loads((ROOT/'market-observatory/data/ai-read-contract.json').read_text())
        rows={x['path']:x for x in contract['required_reads']}
        for path in ['./freshness-status.json','./market-regime.json','./observatory.json']:
            self.assertTrue(rows[path]['required']);self.assertTrue(rows[path]['usable_rule'])
        self.assertIn('end_kst',rows['./market-regime.json']['usable_rule'])
