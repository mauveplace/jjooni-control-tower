import sys
import unittest
from datetime import datetime, timedelta
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'tools'))
from tripod_rules import regime_for, target_for
from build_market_observatory import tripod_history
from build_public_market_daily import build_tripod


class TripodRulesTest(unittest.TestCase):
    def test_hysteresis_and_exact_vix_drawdown_boundaries(self):
        self.assertEqual(regime_for(101, 100, '하락'), '하락')
        self.assertEqual(regime_for(101.01, 100, '하락'), '상승')
        self.assertEqual(regime_for(95, 100, '상승'), '상승')
        self.assertEqual(regime_for(94.99, 100, '상승'), '하락')
        self.assertEqual(target_for('상승', 27.99, -9), 'TQQQ 100%')
        self.assertEqual(target_for('상승', 28, -9), 'QQQ 50% + QLD 50%')
        self.assertEqual(target_for('상승', 20, -9.01), 'QQQ 50% + QLD 50%')
        self.assertEqual(target_for('하락', 17.99, -20), 'QQQ 50% + QLD 50%')
        self.assertEqual(target_for('하락', 18, -20), '현금 100%')

    def test_historical_and_current_regime_agree_after_a_missing_vix_day(self):
        # A down-regime transition occurs on the missing VIX day. It must still
        # persist when the next NDX close returns to the hysteresis band.
        end = datetime.now().date() - timedelta(days=1)
        dates = [(end - timedelta(days=259-i)).isoformat() for i in range(260)]
        prices = [100.0]*260
        prices[-3] = 90
        series = {'NASDAQ100': [{'date': d, 'value': p} for d, p in zip(dates, prices)],
                  'VIX': [{'date': d, 'value': 20} for d in dates if d != dates[-3]]}
        history, _ = tripod_history(series)
        signal = build_tripod({'us_completed_session_date': dates[-1], 'series': series})
        self.assertEqual(history[-1]['regime'], '하락')
        for key in ('regime', 'target', 'ma250', 'vix10', 'drawdown_52w_pct'):
            self.assertEqual(history[-1][key], signal[key])


if __name__ == '__main__':
    unittest.main()
