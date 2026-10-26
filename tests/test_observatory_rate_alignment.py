"""Guard rates against wrong display keys and false same-day freshness."""
import re
import sys
import unittest
from datetime import datetime
from pathlib import Path
from zoneinfo import ZoneInfo
from unittest.mock import patch

ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT/'tools'))
import refresh_observatory_supplementals as sup
import audit_observatory_data as audit


class ObservatoryRateAlignment(unittest.TestCase):
    def test_daily_us_rate_tiles_preserve_market_yield_series_provenance(self):
        board=(ROOT/'market-observatory/latest-board-v1.js').read_text(encoding='utf-8')
        index=(ROOT/'market-observatory/index.html').read_text(encoding='utf-8')
        for key, market in (('US10Y_OFFICIAL','US10Y'),('US30Y_OFFICIAL','US30Y')):
            line=next(line for line in board.splitlines() if line.strip().startswith("{k:'"+key+"'"))
            self.assertIn("seriesKey:'"+market+"'",line)
            self.assertIn(key,board)
        self.assertIn("['US10Y',p.US10Y]",index)
        self.assertNotIn("['US10Y',p.US10Y_OFFICIAL]",index)
        self.assertIn('Cboe 금리지수',board)

    def test_japan_monday_morning_uses_prior_friday(self):
        now=datetime(2026,10,26,8,20,tzinfo=ZoneInfo('Asia/Seoul'))
        self.assertEqual(sup.expected_jgb_business_date(now),'2026-10-23')

    def test_japan_tuesday_morning_expects_monday(self):
        now=datetime(2026,10,27,8,20,tzinfo=ZoneInfo('Asia/Seoul'))
        self.assertEqual(sup.expected_jgb_business_date(now),'2026-10-26')

    def test_japan_afternoon_targets_current_session_only_after_cutoff(self):
        early=datetime(2026,10,27,17,0,tzinfo=ZoneInfo('Asia/Seoul'))
        late=datetime(2026,10,27,19,0,tzinfo=ZoneInfo('Asia/Seoul'))
        self.assertEqual(sup.expected_jgb_business_date(early),'2026-10-26')
        self.assertEqual(sup.expected_jgb_business_date(late),'2026-10-27')

    def test_japan_previous_weekday_must_not_be_declared_live(self):
        date=datetime(2026,10,27,8,20,tzinfo=ZoneInfo('Asia/Seoul'))
        keys=audit.EXPECTED_SERIES['jp_rates']
        observations={k:[{'date':'2026-10-23','value':2.1}] for k in keys}
        obs={'series':observations,'latest':{k:2.1 for k in keys},
             'cross_market_freshness_quality':{'JP_RATES':{'status':'LIVE'}}}
        # Reuse current in-repo audit sources, but replace the market observation
        # and exercise the JP-specific audit region on a real audit build.
        original=audit.load
        with patch.object(audit,'load',side_effect=lambda path,*args,**kwargs:obs if Path(path).name=='observatory.json' else original(path,*args,**kwargs)):
            with patch.object(audit,'datetime',wraps=datetime) as clock:
                clock.now.return_value=date
                result=audit.build()
        self.assertEqual(result['groups']['jp_rates']['state'],'LAGGING')
        self.assertEqual(result['groups']['jp_rates']['expected_latest_weekday'],'2026-10-26')


if __name__=='__main__':unittest.main()
