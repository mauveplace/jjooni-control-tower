# FedWatch · PB / Analyst Read View

- 가격 기준일: 2026-10-08
- 관측 시각: 2026-10-10T12:28:27+09:00
- 수집 당시 상태: LAGGING
- 원천: CME Fed Funds futures settlement-derived FedWatch conditional meeting probability matrix
- 공식 API: NOT_CONFIGURED_SETTLEMENT_DERIVED
- 최신 원문: [fed-watch.json](../fed-watch.json)
- 전체 관측 이력: [index.json](index.json)
- 회의별 확률 CSV: [probabilities.csv](probabilities.csv)

확률은 0~1, 확률 변화는 %p입니다. 생성시각과 가격 기준일은 다릅니다.
과거 파일의 LIVE는 당시 판정이며 현재 데이터라는 뜻이 아닙니다.
서로 다른 날짜를 비교할 때 같은 meeting_date와 target range를 맞추십시오.
next FOMC가 바뀌면 다음회의 확률끼리 단순 비교하지 마십시오.
내장 change_1d/change_1w는 현재 금리 기준으로 재산출한 비교값입니다.
실제 당시 관측 비교는 날짜별 원문 current_target과 matrix를 사용하십시오.
결측 기간은 추정하지 않습니다. 파일 수정 관측은 revisions로 보존합니다.
주문 권한은 없으며 계좌정보를 포함하지 않습니다.

| 가격 기준일 | 관측 시각 | 원문 | 보존 관측 수 |
|---|---|---|---|
| 2026-10-08 | 2026-10-10T12:28:27+09:00 | [JSON](../fedwatch-history/2026-10-08/64dbaa486cd21f2bb542e4292e4b00f609bf92efa6d47123bd7a2c5070d0d01b.json) | 1 |
