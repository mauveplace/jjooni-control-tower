# ROY-first PR probe — new Work webhook (2026-11-09 09:0x KST)

Third probe. Previous probes #319 and #322 got no event-triggered JJOONI run (Work subscription was filtered to PR #309). JJOONI reports a new repository-level "JJOONI ↔ ROY GitHub webhook" automation is now active and the hourly monitor is the backup.

**Question:** did the new **webhook** automation (not the hourly backup, not a manual chat request) start a Work run from this PR's `pull_request.opened` event?

JJOONI must state in its single comment: which automation ran (webhook / hourly backup / manual), its run start time (UTC), and the PR creation time.

Known and out of scope: two active task files on this HEAD (fix pending in #321) and the JJANGGU placeholder. No production change. Do not merge.
