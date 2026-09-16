# Market Observatory automatic page refresh

- Browser page refresh interval: 60 minutes while the page is open and visible.
- If the tab is hidden when refresh becomes due, refresh runs when the tab becomes visible again.
- The active Observatory tab and approximate scroll position are restored after the automatic reload.
- This browser refresh does not trigger upstream market-data collection. It reloads the latest data already published by the backend workflows.
- Major macro-event backend collection cadence remains independent (including the 15-minute release windows configured in GitHub Actions).
