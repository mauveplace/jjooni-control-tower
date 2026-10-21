"""Independent US cash-session clock for collection, recovery and health.

NYSE/ICE 2026-2028 official calendar:
https://ir.theice.com/press/news-details/2025/NYSE-Group-Announces-2026-2027-and-2028-Holiday-and-Early-Closings-Calendar/
The same 15-minute publication grace is used everywhere. Freshly writing an old
session never makes that session current.
"""
from datetime import date, datetime, time, timedelta
from zoneinfo import ZoneInfo

from fedwatch_trade_calendar import _nth_weekday, _last_weekday, _easter_sunday, _observed_fixed

ET=ZoneInfo('America/New_York')
GRACE_MINUTES=15
EARLY_CLOSES={date.fromisoformat(d) for d in (
    '2026-11-27','2026-12-24','2027-11-26','2028-07-03','2028-11-24')}


def holidays(year):
    # Unlike the CME settlement calendar, NYSE is open on Columbus/Veterans Day.
    days={_nth_weekday(year,1,0,3),_nth_weekday(year,2,0,3),
          _easter_sunday(year)-timedelta(days=2),_last_weekday(year,5,0),
          _observed_fixed(date(year,7,4)),_nth_weekday(year,9,0,1),
          _nth_weekday(year,11,3,4),_observed_fixed(date(year,12,25))}
    if year>=2022:days.add(_observed_fixed(date(year,6,19)))
    new_year=date(year,1,1)
    # Saturday New Year does not close the preceding year-end Friday.
    if new_year.weekday()!=5:days.add(_observed_fixed(new_year))
    if year==2025:days.add(date(2025,1,9))
    return days


def trading_day(day):
    return day.weekday()<5 and day not in holidays(day.year)


def expected_completed_session(now=None):
    now=(now or datetime.now(ET)).astimezone(ET)
    day=now.date()
    ready=datetime.combine(day,time(13 if day in EARLY_CLOSES else 16,0),ET)+timedelta(minutes=GRACE_MINUTES)
    if not trading_day(day) or now<ready:day-=timedelta(days=1)
    while not trading_day(day):day-=timedelta(days=1)
    return day.isoformat()


def readiness(obs,pulse,public,now=None):
    expected=expected_completed_session(now)
    actual={'market':obs.get('us_completed_session_date'),
            'pulse':pulse.get('market_date_us'),
            'tripod':(public.get('tripod_signal') or {}).get('date')}
    core_dates={key:str(((obs.get('series') or {}).get(key) or [{}])[-1].get('date') or '')[:10]
                for key in ('NASDAQ100','SP500','VIX')}
    healthy=all(value==expected for value in [*actual.values(),*core_dates.values()]) and pulse.get('snapshot_status')=='FINAL' and (public.get('tripod_signal') or {}).get('ok') is True
    return {'expected_session':expected,'actual_sessions':actual,'core_dates':core_dates,'healthy':healthy}


def require_current(obs,pulse,public,now=None):
    result=readiness(obs,pulse,public,now)
    if not result['healthy']:raise ValueError('US_COMPLETED_SESSION_NOT_CURRENT:'+str(result))
    return result


def refresh_decision(obs,pulse,public,now=None):
    now=now or datetime.now(ET)
    result=readiness(obs,pulse,public,now)
    try:
        stamp=datetime.fromisoformat(obs['generated_kst'])
        if stamp.tzinfo is None:raise ValueError('UNZONED_COLLECTION_CLOCK')
        age=(now-stamp).total_seconds()/60
    except (KeyError,TypeError,ValueError):age=None
    result.update(age_min=age,should_refresh=not result['healthy'] or age is None or age<0 or age>=45)
    return result
