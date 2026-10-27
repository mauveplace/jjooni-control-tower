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
    if now < start: return 'PENDING'
    if now > end: return 'EXPIRED'
    # Time validity does not establish analyst consensus. Incomplete or unknown
    # approval must never be promoted to actionable current guidance.
    consensus = str((regime.get('source') or {}).get('consensus_status') or '').upper()
    authority = str(regime.get('authority') or '').upper()
    if 'PROVISIONAL' in authority or consensus.startswith('PARTIAL') or consensus in {'PENDING', 'PROVISIONAL', 'DRAFT'}:
        return 'PROVISIONAL'
    return 'LIVE' if consensus == 'CLOSED' else 'UNAVAILABLE'

