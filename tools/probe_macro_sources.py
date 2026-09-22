"""Manual, read-only diagnosis using the same registry as production."""
import json
from datetime import datetime
from concurrent.futures import ThreadPoolExecutor
from zoneinfo import ZoneInfo
from official_macro_registry import KR_SERIES, series_id, validate_rows
from official_macro_releases import SourceClient, collect_releases
from build_official_macro import ecos_url


def inspect(pair):
    key, cfg = pair
    today = datetime.now(ZoneInfo('Asia/Seoul'))
    cycle = cfg.get('cycle', 'M')
    start = f'{today.year-1}Q1' if cycle == 'Q' else f'{today.year-1}01'
    end = f'{today.year}Q4' if cycle == 'Q' else today.strftime('%Y%m')
    url = ecos_url('sample', 'StatisticSearch', '1', '10', cfg['stat'], cycle, start, end, cfg['item'], *([cfg['item2']] if cfg.get('item2') else []))
    try:
        data = json.loads(SourceClient().read(url))
        rows = data['StatisticSearch']['row']
        validate_rows(rows, cfg)
        return dict(key=key, status='VERIFIED', series_identity=series_id(cfg), sample=rows[-1], source_url=url)
    except Exception as exc:
        return dict(key=key, status='FAILED', error=f'{type(exc).__name__}:{exc}', source_url=url)


if __name__ == '__main__':
    with ThreadPoolExecutor(max_workers=4) as pool:
        for result in pool.map(inspect, KR_SERIES.items()):
            print(json.dumps(result, ensure_ascii=False), flush=True)
    metrics, errors = collect_releases({})
    print(json.dumps(dict(releases={key:dict(status=m['status'], latest=m.get('latest'), source_url=m.get('source_url')) for key,m in metrics.items()}, errors=errors), ensure_ascii=False), flush=True)
