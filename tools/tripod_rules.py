"""Pure TRI-POD rules shared by daily signal and historical observations.

No account data, I/O, trading primitive, or current-time dependency belongs here.
"""


def regime_for(price: float, ma250: float, previous=None) -> str:
    state = previous or ('상승' if price >= ma250 else '하락')
    if price > ma250 * 1.01:
        return '상승'
    if price < ma250 * 0.95:
        return '하락'
    return state


def target_for(regime: str, vix10: float, dd: float) -> str:
    if regime == '상승':
        return 'TQQQ 100%' if vix10 < 28 and dd >= -9 else 'QQQ 50% + QLD 50%'
    return 'QQQ 50% + QLD 50%' if vix10 < 18 else '현금 100%'
