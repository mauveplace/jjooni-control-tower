"""Shared, non-regressing observation merge and release deadline contract."""
from copy import deepcopy
from datetime import datetime, timedelta
from zoneinfo import ZoneInfo

KST = ZoneInfo('Asia/Seoul')
PROVENANCE = ('source_tier', 'source_url', 'official_url', 'checked_kst',
              'observed_kst', 'verification_status', 'actual_source',
              'official_actual_source', 'official_actual_url', 'official_actual_checked_kst',
              'value_vintage', 'series_id')
RANK = {'OFFICIAL': 3, 'SECONDARY': 2, 'MARKET_FEED': 1}

def clean(v):
    return None if v is None or str(v).strip() in ('', '-', '—', 'None', 'null', 'N/A', 'nan') else v

def rank(row):
    return RANK.get(row.get('source_tier'), 0)

def merge_observation(old, new):
    """Null never erases facts; provenance follows the winning actual atomically."""
    out = deepcopy(old)
    accepted = clean(new.get('actual')) is not None and (clean(old.get('actual')) is None or rank(new) >= rank(old))
    if rank(new) == rank(old) and old.get('value_vintage') == 'AS_RELEASED' and new.get('value_vintage') == 'LATEST_REVISION':
        accepted = False
    if accepted and rank(new)==rank(old) and clean(old.get('actual')) is not None:
        old_time=old.get('checked_kst') or old.get('observed_kst')
        new_time=new.get('checked_kst') or new.get('observed_kst')
        if old_time and (not new_time or str(new_time)<str(old_time)) and not (new.get('value_vintage')=='AS_RELEASED' and old.get('value_vintage')=='LATEST_REVISION'):
            accepted=False
    protected = {'actual', 'source', 'market_data_source', *PROVENANCE}
    for k, v in new.items():
        if k in protected or k == 'market_metrics':
            continue
        if clean(v) is not None:
            if k in ('previous', 'consensus') and clean(old.get(k)) is not None and rank(new) < rank(old):
                continue
            out[k] = deepcopy(v)
    if accepted:
        for k in PROVENANCE:
            out.pop(k, None)
        for k in protected:
            if clean(new.get(k)) is not None:
                out[k] = deepcopy(new[k])
    elif clean(old.get('actual')) is None:
        for k in protected - {'actual'}:
            if clean(new.get(k)) is not None:
                out[k] = deepcopy(new[k])
    out.setdefault('actual', None)
    if 'market_metrics' in old or 'market_metrics' in new:
        metrics = {m.get('key') or m.get('label'): deepcopy(m) for m in old.get('market_metrics', [])}
        for m in new.get('market_metrics', []):
            key = m.get('key') or m.get('label')
            metrics[key] = merge_observation(metrics.get(key, {}), m)
        removed = set((out.get('metric_contract_correction') or {}).get('removed_keys', []))
        out['market_metrics'] = [m for key, m in metrics.items() if key not in removed]
    return out

def event_key(e):
    # A corrected BOK meeting date must not resurrect the old hardcoded day.
    if e.get('country')=='KR' and e.get('title')=='한국은행 통화정책방향 결정회의':
        return (str(e.get('datetime_kst',''))[:7],e['country'],e['title'])
    return (str(e.get('release_date') or e.get('datetime_kst') or e.get('date') or '')[:10], e.get('country'), e.get('title'))

def retain_calendar(current, previous):
    old = {event_key(e): e for e in previous.get('events', [])}
    rows = {}
    for e in current.get('events', []):
        key = event_key(e)
        rows[key] = merge_observation(rows.get(key, old.get(key, {})), e)
    # Preserve unresolved releases as well as observations after feed rollover.
    rows.update({k: deepcopy(e) for k, e in old.items() if k not in rows})
    current['events'] = sorted(rows.values(), key=lambda e: str(e.get('datetime_kst', '')))
    return current

def actual_expected(row):
    return row.get('actual_expected') is not False and row.get('value_role') not in ('schedule_only', 'market_forecast') and row.get('metric_type') != 'market_probability_snapshot'

def release_time(e):
    raw = e.get('datetime_kst') or e.get('date')
    if not raw:
        return None
    dt = datetime.fromisoformat(raw)
    return (dt if dt.tzinfo else dt.replace(tzinfo=KST)).astimezone(KST)

def deadline(e):
    dt = release_time(e)
    if not dt:
        return None
    if e.get('actual_due_kst'):
        due = datetime.fromisoformat(e['actual_due_kst'])
        return due if due.tzinfo else due.replace(tzinfo=KST)
    if e.get('time_status') == 'TBD':
        # End of meeting day, not the noon display placeholder.
        day = e.get('release_date') or dt.date().isoformat()
        return datetime.fromisoformat(day).replace(tzinfo=KST) + timedelta(days=1)
    return dt + timedelta(minutes=e.get('actual_grace_minutes', 45))

def build_freshness(calendar, now, checks):
    pending, overdue = [], []
    for e in calendar.get('events', []):
        e.pop('actual_status', None)
        if not actual_expected(e):
            e['actual_status'] = 'NOT_APPLICABLE'; continue
        if int(e.get('importance') or 0) < 2 and not e.get('actual_watch'):
            continue
        dt = release_time(e)
        if not dt:
            e['actual_status'] = 'OVERDUE'
            overdue.append({'title': e.get('title'), 'reason': 'RELEASE_TIME_MISSING'}); continue
        due = deadline(e)
        e['actual_due_kst'] = due.isoformat()
        e['actual_due_policy'] = 'MEETING_DAY_END_KST' if e.get('time_status') == 'TBD' else 'RELEASE_PLUS_GRACE'
        metrics = [m for m in e.get('market_metrics', []) if actual_expected(m)]
        missing = [m.get('key') or m.get('label') or 'metric' for m in metrics if clean(m.get('actual')) is None]
        if clean(e.get('actual')) is None:
            missing.insert(0, 'event.actual')
        if not missing:
            e['actual_status'] = 'RELEASED'; continue
        start = dt.replace(hour=0, minute=0, second=0) if e.get('time_status') == 'TBD' else dt
        if now < start:
            e['actual_status'] = 'SCHEDULED'; continue
        e['actual_status'] = 'OVERDUE' if now > due else 'PENDING'
        row = {'datetime_kst': dt.isoformat(), 'actual_due_kst': due.isoformat(), 'title': e.get('title'), 'country': e.get('country'), 'missing_metrics': missing, 'status': e['actual_status']}
        (overdue if now > due else pending).append(row)
    return {'status': 'DEGRADED' if overdue else ('PENDING' if pending else 'LIVE'),
            'checked_kst': now.isoformat(timespec='seconds'), 'grace_minutes': 45,
            'unresolved_expiry': None, 'pending_count': len(pending), 'overdue_count': len(overdue),
            'pending_events': pending, 'overdue_events': overdue, 'official_checks': checks}
