"""BLS current-page fallback must never mislabel a later release as historical."""
import sys
import unittest
from datetime import datetime
from pathlib import Path
from unittest.mock import patch
from urllib.error import HTTPError
from zoneinfo import ZoneInfo

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'tools'))
from official_bls_actuals import collect_bls, current_release_url

NY = ZoneInfo('America/New_York')
EVENT = {
    'title': 'U.S. Import and Export Price Indexes',
    'datetime_kst': '2026-10-16T21:30:00+09:00',
    'reference_period': 'September 2026',
}
CURRENT = 'https://www.bls.gov/news.release/ximpim.nr0.htm'


def blocked(url):
    raise HTTPError(url, 403, 'Forbidden', None, None)


class CurrentReleaseFallbackTests(unittest.TestCase):
    def test_current_candidate_is_recent_and_date_bounded(self):
        release = datetime(2026, 10, 16, 8, 30, tzinfo=NY)
        self.assertEqual(current_release_url('ximpim', release, datetime(2026, 10, 29, tzinfo=NY)), CURRENT)
        self.assertIsNone(current_release_url('ximpim', release, datetime(2026, 12, 3, tzinfo=NY)))
        self.assertIsNone(current_release_url('ximpim', release, datetime(2026, 10, 15, tzinfo=NY)))
        self.assertIsNone(current_release_url('jolts', release, datetime(2026, 10, 29, tzinfo=NY)))

    def run_fallback(self, date):
        raw = (f'Transmission of material in this release is embargoed until '
               f'8:30 a.m. (ET) Friday, {date} '
               'U.S. IMPORT AND EXPORT PRICE INDEXES - SEPTEMBER 2026 '
               'U.S. import prices increased 1.1 percent in September. '
               'Prices for U.S. exports increased 2.2 percent in September.').encode()
        def fetch(url):
            if url == CURRENT:
                return raw
            return blocked(url)
        checks = []
        with patch('official_bls_actuals.cached_document', return_value=None), \
             patch('official_bls_actuals.current_release_url', return_value=CURRENT), \
             patch('official_bls_actuals.save_document') as save, \
             patch('official_calendar_collectors.raw_fetch', side_effect=fetch), \
             patch('official_calendar_collectors.text_fetch', side_effect=blocked), \
             patch('official_bls_api.collect_api', return_value=None):
            result = collect_bls(dict(EVENT), 'BLS_ximpim', checks)
        return result, checks, save

    def test_archive_403_current_official_page_exact_date_succeeds(self):
        result, checks, save = self.run_fallback('October 16, 2026')
        self.assertIsNotNone(result)
        rows, url = result
        self.assertEqual(url, CURRENT)
        self.assertEqual({r['key']: r['actual'] for r in rows},
                         {'us_import_price_mom': '1.1%', 'us_export_price_mom': '2.2%'})
        self.assertTrue(all(r['value_vintage'] == 'AS_RELEASED' for r in rows))
        self.assertEqual(sum(c.get('result') == 'HTTP_403' for c in checks), 3)
        save.assert_called_once()

    def test_newer_current_page_is_rejected_and_never_cached(self):
        result, checks, save = self.run_fallback('November 16, 2026')
        self.assertIsNone(result)
        self.assertTrue(any('BLS_RELEASE_DATE_MISMATCH' in c.get('error', '') for c in checks))
        save.assert_not_called()


if __name__ == '__main__':
    unittest.main()
