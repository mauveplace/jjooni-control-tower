# TRI-POD educational rule contract

Confirmed with the user on 2026-10-22 KST. The current daily reference is the user-provided screenshot of https://us-insight.com/secrets/34468 (US completed session 2026-10-21). The screenshot is a displayed-value comparison, not access to the author's underlying chart code.

## Calculation and state

- MA250: arithmetic mean of the latest 250 completed daily NDX closes. VIX10: latest 10 completed daily VIX closes. The 52-week high uses the maximum of the latest 252 completed daily NDX closes.
- Close above MA250 × 1.01 enters the rising regime; close below MA250 × 0.95 enters the falling regime. Between the two lines retain the previous regime. MA250 itself is a reference, not a transition line.
- Rising: TQQQ 100% unless VIX10 ≥ 28 or 52-week drawdown < −9%; either condition reduces the target to QQQ 50% + QLD 50%.
- Falling: VIX10 < 18 targets QQQ 50% + QLD 50%; VIX10 ≥ 18 targets cash 100% (NOPOD).
- An unchanged target means HOLD_NO_TRADE. Crossing the NOPOD price line alone does not unconditionally imply cash.
- BIPOD price line = 52-week high × 0.91. It may stay unchanged across days when the rolling high is unchanged; a 52-week lookback is not a weekly update schedule.
- NOPOD price line = MA250 × 0.95, not a fixed drawdown from the 52-week high.
- Distance to either price line = (line / current NDX close − 1) × 100. This differs from the current 52-week drawdown.
- Daily threshold changes compare the same formula on consecutive completed sessions. Keep underlying precision for calculations; display MA250 and price lines to two decimals. Compare sources on the same completed trading date.

## 2026-10-22 reference comparison (US session 2026-10-21)

| Item | Song reference screenshot | Observatory | Result |
| --- | ---: | ---: | --- |
| NDX close | 29,822.52 | 29,822.52 | Matches |
| Close versus MA250 | 9.2% | 9.20% | Matches |
| VIX10 | 16.65 | 16.65 | Matches |
| 52-week drawdown | −4.49% | −4.49% | Matches |
| BIPOD price | 28,414 | 28,414.27 | Matches integer display |
| Distance to BIPOD | −4.7% | −4.72% | Matches displayed precision |
| NOPOD price | 25,944 | 25,944.16 | Matches integer display |
| Distance to NOPOD | −13% | −13.00% | Matches displayed precision |
| Target | TQQQ 100% | TQQQ 100% | Matches |

MA250 is 27,309.65. The NOPOD line rose from 25,925.38 to 25,944.16, a full-precision daily increase displayed as +18.79 pt. BIPOD remains 28,414.27 because its rolling high is unchanged. The chart cursor label 29,160.83 in the screenshot is not the current NDX close.
