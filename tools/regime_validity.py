from datetime import datetime
from zoneinfo import ZoneInfo
KST=ZoneInfo("Asia/Seoul")

def regime_state(regime, now=None):
    now = now or datetime.now(KST)
    if now.tzinfo is None: now = now.replace(tzinfo=KST)
    try:
        window = regime['effective_window']
        start = datetime.fromisoformat(window['start_kst'])
        end = datetime.fromisoformat(window['end_kst'])
        if start.tzinfo is None or end.tzinfo is None or end < start: return 'UNAVAILABLE'
    except (KeyError, TypeError, ValueError): return 'UNAVAILABLE'
    return 'PENDING' if now < start else 'EXPIRED' if now > end else 'LIVE'

