"""Regression: daily acceptance validates FedWatch forecasts without inventing previous."""
import textwrap
import unittest
from pathlib import Path

WORKFLOW = Path(__file__).resolve().parents[1] / ".github/workflows/market-observatory-daily.yml"


def check_snapshot(snapshot):
    source = WORKFLOW.read_text(encoding="utf-8")
    start = source.index("          # FedWatch is a dated market-probability snapshot")
    end = source.index("          assert a.get('schema')", start)
    code = textwrap.dedent(source[start:end])
    exec(compile(code, str(WORKFLOW), "exec"), {"fw": snapshot})


class DailyFedWatchForecastContractTest(unittest.TestCase):
    def setUp(self):
        self.snapshot = {
            "key": "fedwatch_hike_25bp",
            "consensus": "79.4%",
            "actual": None,
            "source": "CME Fed Funds futures settlement-derived",
            "observed_date": "2026-10-28",
            "metric_type": "market_probability_snapshot",
            "value_role": "market_forecast",
        }

    def test_post_fomc_snapshot_without_previous_is_valid(self):
        check_snapshot(self.snapshot)

    def test_previous_may_be_present_but_is_not_required(self):
        check_snapshot({**self.snapshot, "previous": "18.0%"})

    def test_missing_provenance_is_rejected(self):
        with self.assertRaises(AssertionError):
            check_snapshot({**self.snapshot, "source": None})

    def test_missing_observation_date_is_rejected(self):
        with self.assertRaises(AssertionError):
            check_snapshot({**self.snapshot, "observed_date": None})

    def test_actual_value_must_not_be_fabricated(self):
        with self.assertRaises(AssertionError):
            check_snapshot({**self.snapshot, "actual": "79.4%"})

    def test_forecast_must_keep_snapshot_semantics(self):
        with self.assertRaises(AssertionError):
            check_snapshot({**self.snapshot, "metric_type": "official_actual"})


if __name__ == "__main__":
    unittest.main()
