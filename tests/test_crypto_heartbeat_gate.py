import sys
import unittest
from datetime import datetime, timedelta, timezone
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "tools"))
from crypto_heartbeat_gate import crypto_refresh_decision

NOW = datetime(2026, 10, 31, 11, 0, tzinfo=timezone.utc)


def payload(btc_age=10, eth_age=10, btc_status="LIVE", eth_status="LIVE"):
    return {"crypto_market": {
        "BTCUSD": {"status": btc_status,
                   "quote_as_of_kst": (NOW - timedelta(minutes=btc_age)).isoformat()},
        "ETHUSD": {"status": eth_status,
                   "quote_as_of_kst": (NOW - timedelta(minutes=eth_age)).isoformat()},
    }}


class CryptoHeartbeatGateTests(unittest.TestCase):
    def test_fresh_weekend_quotes_do_not_start_new_job(self):
        self.assertFalse(crypto_refresh_decision(payload(30, 44), NOW)["should_refresh"])

    def test_market_session_can_be_current_while_crypto_is_expired(self):
        data = payload(46, 10)
        data["us_completed_session_date"] = "2026-10-30"
        result = crypto_refresh_decision(data, NOW)
        self.assertTrue(result["should_refresh"])
        self.assertTrue(result["details"]["BTCUSD"]["needs_refresh"])
        self.assertFalse(result["details"]["ETHUSD"]["needs_refresh"])

    def test_exact_threshold_is_actionable(self):
        self.assertTrue(crypto_refresh_decision(payload(45, 10), NOW)["should_refresh"])

    def test_provider_failure_status_is_not_promoted_to_live(self):
        self.assertTrue(crypto_refresh_decision(payload(1, 1, "STALE"), NOW)["should_refresh"])

    def test_missing_or_unzoned_quote_fails_closed(self):
        data = payload()
        del data["crypto_market"]["ETHUSD"]["quote_as_of_kst"]
        self.assertTrue(crypto_refresh_decision(data, NOW)["should_refresh"])
        data["crypto_market"]["ETHUSD"]["quote_as_of_kst"] = "2026-10-31T20:59:00"
        self.assertTrue(crypto_refresh_decision(data, NOW)["should_refresh"])

    def test_future_quote_over_clock_skew_fails_closed(self):
        self.assertTrue(crypto_refresh_decision(payload(-2, 1), NOW)["should_refresh"])

    def test_empty_payload_requires_collection(self):
        self.assertTrue(crypto_refresh_decision({}, NOW)["should_refresh"])


if __name__ == "__main__":
    unittest.main()
