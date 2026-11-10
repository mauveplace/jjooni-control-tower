"""On-demand Observatory collection contract: UI calls are reader-only, not data writers."""
from pathlib import Path
import re
import unittest
import yaml

ROOT = Path(__file__).resolve().parents[1]


def read(path):
    return (ROOT / path).read_text(encoding="utf-8")


def schedules(path):
    return re.findall(r"^\s*- cron: '([^']+)'\s*$", read(path), re.M)


class OnDemandRuntimeTests(unittest.TestCase):
    def test_price_quotes_only_open_resume_manual(self):
        src = read("market-observatory/intraday-quotes-v1.js")
        self.assertIn("root.addEventListener?.('pageshow',resume)", src)
        self.assertIn("document.addEventListener?.('visibilitychange',resume)", src)
        self.assertIn("root.setInterval", src)  # repaint ages, never network
        self.assertNotIn("root.setInterval(resume,120000)", src)
        self.assertIn("if(!force&&(document.hidden||", src)
        self.assertIn("force?'?force=1':''", src)

    def test_published_market_and_status_are_not_polled(self):
        src = read("market-observatory/live-market-refresh-v1.js")
        self.assertIn("mode:'ON_OPEN_OR_RESUME'", src)
        self.assertNotIn("setInterval(()=>refresh()", src)
        self.assertIn("document.addEventListener('visibilitychange'", src)
        self.assertIn("root.addEventListener('pageshow'", src)
        status = read("market-observatory/freshness-watchdog-v1.js")
        self.assertNotIn("setInterval(()=>{if(!document.hidden)load()}", status)
        self.assertIn("if(!document.hidden)load()", status)

    def test_official_macro_and_rates_tab_reads_not_network_poll(self):
        macro = read("market-observatory/official-macro-v1.js")
        rates = read("market-observatory/us-rates-intraday-v1.js")
        self.assertNotIn("setInterval(()=>{if(!document.hidden", macro)
        self.assertNotIn("setInterval(()=>{if(!doc.hidden", rates)
        self.assertIn("data-rate-read", rates)
        self.assertIn('button[data-tab="official-macro"]', macro)
        self.assertIn('button[data-tab="rates"]', rates)

    def test_official_fedwatch_no_forced_hourly_reload(self):
        src = read("market-observatory/fed-watch-v1.js")
        self.assertNotIn("setInterval(autoRefreshTick", src)
        self.assertIn("mode:'ON_DEMAND_TAB_OPEN_OR_RESUME'", src)

    def test_runtime_cache_busters_updated(self):
        html = read("market-observatory/index.html")
        for name in ("intraday-quotes-v1.js", "live-market-refresh-v1.js",
                     "freshness-watchdog-v1.js", "data-refresh-v1.js",
                     "fed-watch-v1.js", "us-rates-intraday-v1.js",
                     "official-macro-v1.js"):
            self.assertIn(name + "?v=20261110-on-demand", html)


class LowFrequencyWriterTests(unittest.TestCase):
    def test_relay_manual_read_only_and_no_handover(self):
        path = ".github/workflows/observatory-heartbeat.yml"
        content = read(path)
        config = yaml.safe_load(content)
        self.assertEqual(config["permissions"], {"contents": "read"})
        self.assertNotIn("schedule:", content)
        self.assertIn("workflow_dispatch:", content)
        self.assertNotIn("gh workflow run", content)
        self.assertNotIn("sleep", content)
        self.assertIn("observatory_heartbeat_decision.py", content)

    def test_market_close_jobs_remain_independent(self):
        daily = ".github/workflows/market-observatory-daily.yml"
        self.assertEqual(schedules(daily), ["20 20,21 * * 0-5", "10 7 * * 1-5"])
        content = read(daily)
        self.assertIn("inputs.heartbeat", content)
        self.assertNotIn("  workflow_run:", content)
        self.assertIn("Gate US close refresh with scheduler delay tolerance", content)
        self.assertIn("economic-calendar-canonical-writer", content)
        close = read(".github/workflows/market-observatory-close-watchdog.yml")
        self.assertIn("20,50 20,21 * * 0-5", close)
        self.assertIn("Market Observatory Daily + Calendar", close)

    def test_crypto_and_rates_are_archived_only_daily(self):
        self.assertEqual(schedules(".github/workflows/observatory-crypto-refresh.yml"),
                         ["35 21 * * *"])
        self.assertEqual(schedules(".github/workflows/observatory-us-rates-intraday.yml"),
                         ["45 21 * * 1-5"])
        self.assertEqual(schedules(".github/workflows/market-observatory-supplemental-freshness.yml"),
                         ["40 7 * * 1-5", "50 21 * * 0-5"])
        self.assertNotIn("  workflow_run:", read(".github/workflows/market-observatory-supplemental-freshness.yml"))

    def test_official_release_capture_still_scheduled(self):
        content = read(".github/workflows/economic-calendar-light-refresh.yml")
        self.assertIn("*/15 10-14 * * 1-5", content)
        self.assertIn("*/15 17-19 * * 1-5", content)
        self.assertIn("  workflow_dispatch:", content)
        pulse = read(".github/workflows/market-observatory-daily-pulse.yml")
        self.assertIn("10 20 * * 0-5", pulse)
        self.assertIn("10 21 * * 0-5", pulse)

    def test_inactive_pages_action_has_no_dormant_timer(self):
        source = read(".github/workflows/pages-controlled-deploy.yml")
        self.assertNotIn("  schedule:", source)
        self.assertIn("  workflow_dispatch:", source)
        self.assertIn("vars.PAGES_ACTIONS_ENABLED == 'true'", source)


if __name__ == "__main__":
    unittest.main()
