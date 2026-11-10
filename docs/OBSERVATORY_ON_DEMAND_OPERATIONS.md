# Observatory: on-view market reads, event-driven official publication

Effective only after the PR is merged and public Pages serves the new UI.

## Why
The former nearly six-hour heartbeat job checked every five minutes and chained
more runs. Crypto and US rates jobs collected twice an hour; cross-market
supplements hourly, and daily market freshness checks four times an hour.
Many data commits could cause unnecessary Pages builds even with no user viewing.

## Design
- On page open, return or explicit Now Refresh, use the existing public Cloud Run
  Observatory quote API; retain a 60-second lifecycle guard and single-flight
  protection. No GitHub token or write operation is available to the browser.
- Published market, official macro, rates, FedWatch and freshness panels fetch
  static JSON when opened/resumed or when manually asked to re-read. No network
  polling per minute and no automatic whole-page reload.
- Keep US-close and KR-close official capture, US-close freshness recovery,
  completed-close TRI-POD and Daily Pulse, and official calendar releases.
- BTC/ETH remain an explicit once-hourly, source-attributed exception because
  the existing on-demand quote endpoint excludes BTCUSD/ETHUSD and has no
  approved USDT/USD quote-currency/previous-close reconciliation. Do not claim
  live crypto from that API. Show the true crypto observation time and stale
  status, and retire the hourly fallback only after a verified on-demand source.
- US yields are sampled hourly only in the US-trading-session UTC window,
  rather than every 30 minutes around the clock. Existing historical 5-minute
  data remain available; new intraday bars are less dense, with source times
  shown. No unverified live-yield price is substituted from the quote API.
- Cross-market supplemental facts are archived after KR and US closing only.
- Previous five-minute relay is a manual read-only health diagnostic only:
  no chained runner, writes, issue alerts or privileged job dispatch.
- Staged GitHub Actions Pages deployment is manual only. Do not switch the
  live GitHub Pages Source from the existing branch-publishing mode yet.

## Data integrity
Never substitute a live quote for official completed-session NDX, VIX,
TRI-POD, economic actual or market closing data. Retain quote timestamps,
source attribution, prior close bases and LIVE/STALE labeling. The independent
US-close watchdog is left in place to recover missing finalized sessions.
Failed quote API responses retain previous confirmed values and show errors.

## Limitations and verification
Browser visits cannot trigger privileged GitHub Actions. The manual source
capture remains available through the GitHub UI. Other official workflows may
still generate Pages builds on genuine new public data; an external Pages
timeout cannot be mathematically eliminated just by dropping unnecessary
refresh calls.

Before release: exact-HEAD CI PASS and ROY review of cadence risks.
After release: verify served script version, current quotes on user activity,
no unintended scheduled runners, correct completed-close market dates,
TRI-POD and next morning brief. Keep alerts for genuine close/official failures.
Rollback: revert the PR; no Pages Source or account permission change needed.
