#!/usr/bin/env python3
"""Update only crypto observations; retain all other source timestamps and facts."""
import json
from datetime import datetime
from add_observatory_equities import OBS, KST, CRYPTO_SYMBOLS, enrich_crypto


def main():
    data = json.loads(OBS.read_text(encoding='utf-8'))
    enrich_crypto(data)
    for key in CRYPTO_SYMBOLS:
        quote = data.get('crypto_market', {}).get(key, {})
        if quote.get('status') != 'LIVE':
            raise SystemExit(f'CRYPTO_REFRESH=FAIL {key}: {quote.get("status")}')
        assert data['series'][key][-1]['value'] == data['latest'][key]
        assert abs(data['latest'][key] - quote['price']) < 0.000001
    data['crypto_enriched_kst'] = datetime.now(KST).isoformat(timespec='seconds')
    OBS.write_text(json.dumps(data, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    print('CRYPTO_REFRESH=PASS', data['crypto_enriched_kst'])


if __name__ == '__main__':
    main()
