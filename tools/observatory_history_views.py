"""Content-addressed reader views and immutable Daily Pulse observations."""
import hashlib
import json
from pathlib import Path


def encoded(value):
    return (json.dumps(value, ensure_ascii=False, sort_keys=True, indent=2) + '\n').encode()


def immutable(path, payload):
    raw = encoded(payload)
    digest = hashlib.sha256(raw).hexdigest()
    target = path / (digest + '.json')
    target.parent.mkdir(parents=True, exist_ok=True)
    if target.exists() and target.read_bytes() != raw:
        raise ValueError('Immutable observation collision: ' + str(target))
    if not target.exists():
        target.write_bytes(raw)
    return target, digest


def write_calendar_views(root):
    data = root / 'market-observatory/data'
    raw = (data / 'economic-calendar-history.json').read_bytes()
    history = json.loads(raw)
    snapshot = hashlib.sha256(raw).hexdigest()
    index = {k: v for k, v in history.items() if k != 'series'}
    index.update(schema='JJOONI_CALENDAR_HISTORY_INDEX_V1', snapshot_id=snapshot,
                 source_sha256=snapshot, series={})
    paths = []
    for ref, bucket in (history.get('series') or {}).items():
        payload = {'schema': 'JJOONI_CALENDAR_HISTORY_SERIES_V1', 'ref': ref, 'bucket': bucket}
        target, digest = immutable(data / 'calendar-history/series', payload)
        paths.append(target)
        index['series'][ref] = {k: v for k, v in bucket.items() if k != 'rows'}
        index['series'][ref].update(path='./calendar-history/series/' + target.name, sha256=digest)
    target = data / 'calendar-history-index.json'
    target.write_bytes(encoded(index))
    paths.append(target)
    return paths


def archive_pulse(root):
    data = root / 'market-observatory/data'
    pulse = json.loads((data / 'daily-market-pulse.json').read_bytes())
    # Archive exact current facts/rules; the compact 400-row summary stays in latest.
    observation = {k: v for k, v in pulse.items() if k != 'history'}
    observation['archive_contract'] = 'IMMUTABLE_FACTS_AND_RULES_NOT_AI_COMMENTARY_V1'
    path, digest = immutable(data / 'pulse-history/observations', observation)
    index_path = data / 'pulse-history/index.json'
    index = json.loads(index_path.read_bytes()) if index_path.exists() else {}
    rows = {r['snapshot_id']: r for r in index.get('observations') or []}
    rows[digest] = {'snapshot_id': digest, 'market_date_us': pulse.get('market_date_us'),
                    'generated_kst': pulse.get('generated_kst'),
                    'quality': (pulse.get('quality') or {}).get('status'),
                    'path': './observations/' + path.name}
    index = {'schema': 'JJOONI_DAILY_PULSE_HISTORY_INDEX_V1',
             'retention': 'NO_AUTOMATIC_EXPIRY', 'historical_live_is_not_current': True,
             'commentary_policy': 'AI_COMMENTARY_MUST_REFERENCE_OBSERVATION_SNAPSHOT_ID',
             'observations': sorted(rows.values(), key=lambda r: (str(r.get('market_date_us')), str(r.get('generated_kst')), r['snapshot_id']))}
    index_path.write_bytes(encoded(index))
    return [path, index_path]


def materialize(root, paths):
    added = []
    if 'market-observatory/data/economic-calendar-history.json' in paths:
        added.extend(write_calendar_views(root))
    if 'market-observatory/data/daily-market-pulse.json' in paths:
        added.extend(archive_pulse(root))
    return [str(p.relative_to(root)) for p in added]
