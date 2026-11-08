"""Official series fallback, explicitly distinguished from release-vintage data.

A reference month must come from the official schedule/release. Never infer it
from the announcement month: shutdowns and postponements break that assumption.

When the release page is unreachable (www.bls.gov answers HTTP 403 to automated
clients regardless of User-Agent), the reference month is taken from the BLS API
itself: the observation BLS flags ``latest`` is, by BLS's own definition, the
period of the most recent release. That is only trusted for a release that is
still the most recent one (within RECENT_RELEASE_DAYS) and whose latest period
sits 1-3 months before the release month; anything else stays unresolved.
"""
import calendar
import json
import re
from decimal import Decimal, ROUND_HALF_UP
from datetime import datetime, timedelta, timezone
from functools import lru_cache

API = 'https://api.bls.gov/publicAPI/v2/timeseries/data/'
# Monthly BLS releases are >=27 days apart; inside this window no newer release
# of the same report can have moved the API's ``latest`` flag.
RECENT_RELEASE_DAYS = 25
# key: (official series, comparison months, display unit)
SERIES = {
    'cpi': {'cpi_yoy': ('CUUR0000SA0', 12, '%'),
            'cpi_mom': ('CUSR0000SA0', 1, '%'),
            'core_cpi_yoy': ('CUUR0000SA0L1E', 12, '%'),
            'core_cpi_mom': ('CUSR0000SA0L1E', 1, '%')},
    'ppi': {'ppi_yoy': ('WPUFD4', 12, '%'), 'ppi_mom': ('WPSFD4', 1, '%'),
            'core_ppi_yoy': ('WPUFD49104', 12, '%'),
            'core_ppi_mom': ('WPSFD49104', 1, '%')},
    'empsit': {'nfp': ('CES0000000001', 1, 'K'),
               'unemployment': ('LNS14000000', 0, '%'),
               'avg_hourly_mom': ('CES0500000003', 1, '%'),
               'avg_hourly_yoy': ('CES0500000003', 12, '%')},
    'ximpim': {'us_import_price_mom': ('EIUIR', 1, '%'),
               'us_export_price_mom': ('EIUIQ', 1, '%')},
    'jolts': {'jolts': ('JTS000000000000000JOL', 0, 'M')},
}


def reference_month(value):
    names = '|'.join(calendar.month_name[1:])
    match = re.search(r'\b(' + names + r')\s+(20\d{2})\b', str(value), re.I)
    if match:
        month = list(calendar.month_name).index(match[1].capitalize())
        return int(match[2]), month
    match = re.fullmatch(r'(20\d{2})-(0[1-9]|1[0-2])', str(value).strip())
    return tuple(map(int, match.groups())) if match else None


@lru_cache(maxsize=32)
def _series_rows(series, year):
    from official_calendar_collectors import raw_fetch
    url = f'{API}{series}?startyear={year-1}&endyear={year}'
    data = json.loads(raw_fetch(url))
    if data.get('status') != 'REQUEST_SUCCEEDED':
        raise ValueError('BLS_API_REQUEST_FAILED: ' + str(data.get('message')))
    results = data.get('Results', {})
    if isinstance(results, list):
        results = results[0] if results else {}
    rows = next((x['data'] for x in results.get('series', []) if x.get('seriesID') == series), [])
    return tuple(rows), url


def fetch_series(series, year):
    rows, url = _series_rows(series, year)
    values = {(int(x['year']), int(x['period'][1:])): Decimal(x['value'])
              for x in rows if re.fullmatch(r'M(?:0[1-9]|1[0-2])', x['period'])
              and re.fullmatch(r'-?\d+(?:\.\d+)?', x['value'])}
    return values, url


def latest_period(series, year):
    """(year, month) BLS flags as ``latest`` for this series, or None."""
    rows, _ = _series_rows(series, year)
    row = next((x for x in rows if str(x.get('latest')).lower() == 'true'), None)
    if not row or not re.fullmatch(r'M(?:0[1-9]|1[0-2])', row.get('period', '')):
        return None
    return int(row['year']), int(row['period'][1:])


def api_reference_month(event, code, now=None):
    """Reference month of a still-current release, read from BLS's own ``latest`` flag."""
    from calendar_actual_contract import release_time
    if code not in SERIES:
        return None
    try:
        released = release_time(event)
    except Exception:
        released = None
    if not released:
        return None
    now = now or datetime.now(timezone.utc)
    age = now - released
    if age < timedelta(0) or age > timedelta(days=RECENT_RELEASE_DAYS):
        return None
    series = next(iter(SERIES[code].values()))[0]
    period = latest_period(series, released.year)
    if not period:
        return None
    gap = (released.year * 12 + released.month) - (period[0] * 12 + period[1])
    # Monthly BLS reports always describe an earlier month (1-3 months back).
    return period if 1 <= gap <= 3 else None


def calculate(values, year, month, lag, unit):
    value = values[(year, month)]
    if lag:
        ordinal = year * 12 + month - 1 - lag
        previous = values[(ordinal // 12, ordinal % 12 + 1)]
        value = value - previous if unit == 'K' else (value / previous - 1) * 100
    if unit == 'M':
        value /= 1000
    if unit == 'K':
        return f'{value.normalize():f}K'
    return f'{value.quantize(Decimal("0.1"), rounding=ROUND_HALF_UP):f}{unit}'


def collect_api(event, code, checks, now=None):
    period = reference_month(event.get('reference_period'))
    if not period and code in SERIES:
        try:
            period = api_reference_month(event, code, now)
        except Exception as exc:
            checks.append({'adapter': 'BLS_API', 'title': event['title'],
                           'result': 'LATEST_PERIOD_LOOKUP_FAILED', 'error': str(exc)[:200]})
            period = None
        if period:
            event['reference_period'] = f'{calendar.month_name[period[1]]} {period[0]}'
            event['reference_period_source'] = 'BLS_API_LATEST_FLAG'
            checks.append({'adapter': 'BLS_API', 'title': event['title'],
                           'result': 'REFERENCE_PERIOD_FROM_API_LATEST',
                           'reference_period': f'{period[0]}-{period[1]:02d}'})
    if not period or code not in SERIES:
        checks.append({'adapter': 'BLS_API', 'title': event['title'],
                       'result': 'REFERENCE_PERIOD_MISSING' if not period else 'SERIES_NOT_CONFIGURED'})
        return None
    year, month = period
    rows = []
    for key, (series, lag, unit) in SERIES[code].items():
        try:
            values, url = fetch_series(series, year)
            actual = calculate(values, year, month, lag, unit)
            rows.append(dict(key=key, label=key, actual=actual, source_url=url,
                             official_url=url, source_tier='OFFICIAL',
                             verification_status='VERIFIED_OFFICIAL_REVISED',
                             value_vintage='LATEST_REVISION',
                             reference_period=f'{year}-{month:02d}', series_id=series))
            checks.append(dict(adapter='BLS_API', url=url, result='PARSED_REVISED_SERIES', key=key))
        except Exception as exc:
            checks.append(dict(adapter='BLS_API', series_id=series, key=key,
                               result=type(exc).__name__, error=str(exc)[:200]))
    return (rows, rows[0]['source_url']) if rows else None
