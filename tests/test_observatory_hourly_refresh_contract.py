#!/usr/bin/env python3
"""The published FedWatch view must not refresh the entire site every hour."""
from pathlib import Path

s=Path('market-observatory/fed-watch-v1.js').read_text(encoding='utf-8')
for token in ['ON_DEMAND_TAB_OPEN_OR_RESUME', 'visibilitychange', 'pageshow', 'restoreViewAfterAutoRefresh']:
    assert token in s, token
for unwanted in ['setInterval(autoRefreshTick', 'AUTO_REFRESH_MS=60*60*1000', "mode:'PAGE_RELOAD_LATEST_PUBLISHED_DATA'"]:
    assert unwanted not in s, unwanted
print('OBSERVATORY_ON_DEMAND_FEDWATCH_CONTRACT=PASS')
