"""Shared history merge: actual provenance is atomic; expectations stay separate."""
from copy import deepcopy
from calendar_actual_contract import merge_observation, rank, clean


def merge_history_observation(old, incoming):
    out = merge_observation(old, incoming)
    for field in ('previous', 'consensus', 'te_forecast'):
        if clean(incoming.get(field)) is None:
            continue
        old_rank = rank({'source_tier': old.get(field + '_source_tier') or old.get('source_tier')})
        new_rank = rank({'source_tier': incoming.get(field + '_source_tier') or incoming.get('source_tier')})
        if clean(old.get(field)) is None or new_rank >= old_rank:
            out[field] = incoming[field]
            out[field + '_source'] = incoming.get(field + '_source') or incoming.get('source')
            out[field + '_source_tier'] = incoming.get(field + '_source_tier') or incoming.get('source_tier')
        else:
            out[field] = old[field]
            for suffix in ('_source', '_source_tier'):
                if field + suffix in old:
                    out[field + suffix] = old[field + suffix]
                else:
                    out.pop(field + suffix, None)
    if clean(old.get('actual')) is not None and out.get('actual') != incoming.get('actual'):
        # Incoming surprise was computed against a rejected actual.
        if 'surprise' in old:
            out['surprise'] = old['surprise']
        else:
            out.pop('surprise', None)
    revisions = deepcopy(old.get('revisions') or [])
    for revision in incoming.get('revisions') or []:
        if revision not in revisions:
            revisions.append(deepcopy(revision))
    if clean(old.get('actual')) is not None and clean(incoming.get('actual')) is not None and old['actual'] != incoming['actual']:
        record = {k: incoming.get(k) for k in ('actual', 'source', 'source_tier', 'checked_kst', 'value_vintage')}
        record['accepted'] = out.get('actual') == incoming['actual']
        record['prior_actual'] = old['actual']
        if record not in revisions:
            revisions.append(record)
    if revisions:
        out['revisions'] = revisions
    return out


def merge_history_documents(local, remote):
    result = deepcopy(local)
    series = deepcopy(remote.get('series') or {})
    for ref, bucket in (local.get('series') or {}).items():
        target = series.setdefault(ref, {**bucket, 'rows': []})
        rows = {(r.get('date'), r.get('metric_key')): deepcopy(r) for r in target['rows']}
        for row in bucket.get('rows') or []:
            key = (row.get('date'), row.get('metric_key'))
            rows[key] = merge_history_observation(rows.get(key, {}), row)
        start, end = result.get('window_start', ''), result.get('window_end', '9999-12-31')
        target['rows'] = sorted((r for r in rows.values() if start <= str(r.get('date') or '') <= end), key=lambda r: (r.get('date') or '', str(r.get('metric_key') or '')))
        target['count'] = len(target['rows'])
        target['available_from'] = target['rows'][0]['date'] if target['rows'] else None
        target['available_to'] = target['rows'][-1]['date'] if target['rows'] else None
    result['series'] = series
    result['series_count'] = len(series)
    result['row_count'] = sum(len(b.get('rows') or []) for b in series.values())
    dates = [r['date'] for b in series.values() for r in b.get('rows', []) if r.get('date')]
    result['available_from'] = min(dates) if dates else None
    result['available_to'] = max(dates) if dates else None
    return result
