"""Explicit ECOS series identities. Never select a statistical series by fuzzy title."""
KR_SERIES = {
    'KR_BASE_RATE': dict(stat='722Y001', item='0101000', name='한국 기준금리', group='policy', institution='BOK', kind='level', unit='%', raw_unit='%'),
    'KR_CPI': dict(stat='901Y009', item='0', name='CPI', group='inflation', institution='KOSTAT', kind='monthly_index', unit='%', raw_unit='2020=100', target=2.0),
    'KR_GDP': dict(stat='200Y102', item='10111', cycle='Q', name='실질 GDP 전기비', group='growth', institution='BOK', kind='direct', unit='% QoQ SA', raw_unit='%'),
    'KR_CORE_CPI': dict(stat='901Y010', item='DB', name='Core CPI (식료품·에너지 제외)', group='inflation', institution='KOSTAT', kind='monthly_index', unit='%', raw_unit='2020=100'),
    'KR_CURRENT_ACCOUNT': dict(stat='301Y013', item='000000', name='경상수지 (원계열)', group='external', institution='BOK', kind='level', unit='USD million', raw_unit='백만달러'),
    'KR_EXPORT_YOY': dict(stat='901Y118', item='T002', name='월간 수출 YoY', group='exports', institution='KCS', kind='monthly_index', unit='%', raw_unit='천불'),
    'KR_INDUSTRIAL_PRODUCTION': dict(stat='901Y033', item='A00', item2='2', name='전산업생산 (농림어업 제외)', group='growth', institution='KOSTAT', kind='monthly_mom', unit='% MoM SA', raw_unit='2020=100'),
}


def series_id(cfg):
    return '/'.join([cfg['stat'], cfg.get('cycle', 'M'), cfg['item']] + ([cfg['item2']] if cfg.get('item2') else []))


def lookup(stat, item, item2=None):
    return next(((key, cfg) for key, cfg in KR_SERIES.items()
                 if (cfg['stat'], cfg['item'], cfg.get('item2')) == (stat, item, item2)), (None, None))


def validate_rows(rows, cfg):
    for row in rows:
        # API fixtures without metadata are used by transport-only tests; real
        # responses always carry STAT_CODE. A changed identity or base fails closed.
        if 'STAT_CODE' not in row:
            continue
        if (row.get('STAT_CODE'), row.get('ITEM_CODE1'), row.get('ITEM_CODE2')) != (cfg['stat'], cfg['item'], cfg.get('item2')):
            raise ValueError('ECOS_SERIES_MISMATCH:identity')
        if str(row.get('UNIT_NAME', '')).replace(' ', '') != cfg['raw_unit'].replace(' ', ''):
            raise ValueError('ECOS_SERIES_MISMATCH:unit')
