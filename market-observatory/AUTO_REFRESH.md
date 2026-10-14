# Market Observatory automatic page refresh

- Scheduled backend collection remains enabled.
- Opening Observatory reads published JSON with cache bypass; it does not claim to start source collection.
- The header **데이터 최신화** button opens the authenticated GitHub collection workflow. Sign in as a repository writer and choose **Run workflow → Run workflow**, with branch `main`.
- Observatory then watches only manual `main` runs created after that button press. Opening GitHub alone is shown as waiting, not running.
- Completion requires a matching `refresh-receipt.json` to reach the live Pages site. Collector success alone is not treated as deployed data.
- Independent source failures are displayed as partial publication. A failed run, API error, or timeout preserves displayed observations and is never called a successful refresh.
- **게시 데이터 다시 읽기** reloads already published data, preserving the selected tab and scroll position.
- GitHub Pages is static hosting. Fully automatic collection on page open or one-click dispatch without the GitHub confirmation requires an authenticated server endpoint; no GitHub access token is shipped to browsers.

- Browser page refresh interval: 60 minutes while the page is open and visible.
- If the tab is hidden when refresh becomes due, refresh runs when the tab becomes visible again.
- The active Observatory tab and approximate scroll position are restored after the automatic reload.
- This browser refresh does not trigger upstream market-data collection. It reloads the latest data already published by the backend workflows.
- Major macro-event backend collection cadence remains independent (including the 15-minute release windows configured in GitHub Actions).
