#!/usr/bin/env python3
from pathlib import Path

p=Path('market-observatory/fed-watch-v1.js')
s=p.read_text(encoding='utf-8')
for token in [
    'AUTO_REFRESH_MS=60*60*1000',
    'PAGE_RELOAD_LATEST_PUBLISHED_DATA',
    'preserve_view:true',
    'visibilitychange',
    'reloadPreservingView',
]:
    assert token in s, token
print('OBSERVATORY_HOURLY_REFRESH_CONTRACT=PASS')
