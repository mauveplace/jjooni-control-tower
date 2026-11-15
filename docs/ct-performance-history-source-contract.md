# Human V2 — 검증된 투자성과 3종 그래프 원천 계약

작성: 2026-11-15 · 스키마 CT_RECONCILED_PERFORMANCE_HISTORY_V1

## 확인된 문제
기존 live-bridge.js는 D.human.performance 배열의 해당 날짜에 CANONICAL_CURRENT_OBSERVATION을 upsert합니다. 따라서 기존 그래프 원장과 현재 관측값이 섞일 수 있습니다. 이 배열만으로 장기 순자산 및 성과를 확정해서는 안 됩니다.

## 데이터 원천
소비자 위치: window.__JJOONI_LIVE_PAYLOAD.performance_history.
필수 필드:
- schema: CT_RECONCILED_PERFORMANCE_HISTORY_V1
- status: VERIFIED
- bound_snapshot_id: 같은 시점의 live/canonical 양쪽 snapshot_id와 완전히 일치
- verified_at_kst: 유효한 ISO timestamp (미래 시각 불가)
- accounts: TOSS, ISA, PENSION, IRP 정확히 4개 (TRIPOD 제외)
- asset_class_partition: DISJOINT (3번 차트만 사용하는 조건)
- rows: 날짜 순서 배열, 최소 2행 ~ 최대 366행. 날짜 YYYY-MM-DD.
- rows[].nav_krw: 해당 일 4계좌 전체 원화 평가액
- rows[].investment_pnl_krw: 해당 일 외부입출금과 분리된 투자손익
- rows[].net_cash_flow_krw: 해당 일 외부 순입출금
- rows[].asset_class_contributions_krw: 카테고리 키별 수익 기여액. 예시 범주 KR_STOCK/US_STOCK, 다만 실제 생산자가 범주 정의 및 중복 여부를 승인해야 함.

동시에 live.source_health.pb_history.state가 OK 또는 VERIFIED여야 합니다.

## 회계 검증 계약
- 모든 날짜에 NAV·손익·순입출금이 있어야 하며 결측을 0으로 취급하지 않음.
- 두 이웃 행의 날짜순 NAV 증감은 해당 새 날짜의 investment_pnl + net_cash_flow와 일치해야 함. KRW 반올림 수준 이외의 차이는 전체 선·막대 그래프 차단.
- 날짜 중복·역순·비정상 금액·원장/계좌 시점 불일치 모두 차단.
- 자산군 기여는 중복 없는(disjoint) 범주인 경우에만 화면 표시. 매일 자산군별 합계가 전체 투자손익과 일치하지 않으면 1·2번은 유지, 3번만 차단.
- ETF·펀드 유형과 국가/섹터 분류 등을 중복 합산하지 않음. 이 계약은 개별 투자상품의 기여 산식을 새로 계산하지 않음.
- 기준일 사이에 누락된 거래일의 손익을 임의로 채워 넣지 않음.
- 화면은 스냅샷 생성시각이 아닌 검증된 이력의 verified_at_kst를 출처로 표시.

## 화면 구성
① 일별 순자산(NAV) 라인 ② 일별 투자손익(P&L) 막대 ③ 자산군별 기간 투자손익 기여 막대.
원장 내역 펼치기에는 날짜/NAV/투자손익/외부입출금 4개 컬럼을 표시.
원천이 없거나 미검증인 경우 숫자·곡선을 만들어 그리지 않고 검증 대기 사유를 표시. V1 모드에서는 화면 미표시.

## 다음 필수 이행 과제
1. 기존 PB history 원천을 검토해 원장별 4계좌 NAV, 순입출금, 투자손익 완결성 검증을 서버에서 수행.
2. 검증한 원천을 실시간 snapshot_id와 같은 atomically published payload의 performance_history에 제공. legacy upsert 결과를 재포장하는 방식은 금지.
3. 외부입출금·실현손익·배당·환율·상품 분류를 재대사해 중복 없는 자산군 기여를 제공.
4. 실계좌 승인 브라우저에서 화면과 실제 원장 수치 대조, 로이 별도 독립 검토 실시.
5. 생산자 공급 확인 전에는 3종 그래프 '전체 완성'이라고 선언하지 않음.

## 테스트
- tests/ct-performance-history.test.cjs (스키마/기간/NAV 대사/분류 검증)
- tests/ct-performance-history-e2e.cjs (합성 데이터 브라우저 E2E)
- 실제 개인 계좌 정보는 공개 저장소/테스트에 넣지 않음.
