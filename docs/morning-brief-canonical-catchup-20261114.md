# 2026-11-14 아침 시황 누락 RCA 및 재발 방지

## 확정된 실행 시각 (KST)
- Work 예약 06:25 / 실제 실행 06:29:30~06:40:06 / 시황 PR #451 발행 06:32:48. 시각 정정 PR #452로 실제 발행시각은 보존.
- Observatory 06:34:06, Daily Pulse 06:34:38, Daily Glance 06:36:45에 각각 2026-11-13 미국 완료 세션 반영. 보고서 발행 뒤에 원장이 도착하여 첫 발행 당시의 NDX/SOX/VIX10/MA250/DD 공백이 그대로 남았다.
- tools/check_morning_publication.py는 브리핑 날짜와 Observatory 세션을 따로 확인하지만, 서로의 생성시각/버전이 일치하는지를 판정하지 않는다. 녹색 CI는 원본 시황의 가격 정확성을 증명하지 않는다.
- 원장의 price_crosscheck=NOT_VERIFIED. Observatory 계열 참고 NDX=27943.7363은 단일 원천계열 가격이다. Nasdaq dynamic Overview의 숫자와 Yahoo Historical EOD가 상이하게 표시되므로 별도 공식 종가 이중검증 없이는 VERIFIED나 매매 신호로 승격하지 않는다.
- SOX는 현재 정규화된 Daily Glance 및 Daily Pulse에 없다. 본 UI 보완은 SOX를 지어내지 않는다. 별도 SOX EOD 신뢰 원천 수집은 독립 검토 과제다.

## 실제 적용
1. 기존 아침 시황 Work 시작을 New York 16:25에서 16:45로 조정 완료(EST 오전 06:45 KST, EDT 05:45 KST). 과거 오전 06:30 목표보다 늦지만 날짜별 원장이 준비되기 전에 게시할 위험을 낮춘다. 원장 미완이면 NOT_READY를 기록하고 성급한 최종 발행을 막는다.
2. 브리핑 읽기 화면은 latest 보고서 외에 Daily Glance와 Daily Pulse를 독립적으로 최신 조회한다. 동일 미국 완료 세션 + FINAL + 읽기전용 + consistency=OK + NDX/변동률 같은 원장 교차확인을 만족할 때만 NDX·VIX10·MA250·DD·기존 Pod를 단일원장 참고 패널로 표시한다.
3. 정규 EOD close_checks, 최초 보고서 본문, 원 발행시간, NO_TRADE_REVIEW_ONLY는 그대로 둔다. 참고 데이터는 공식 종가 이중검증이 아니고 최신 시점의 표시용이다.
4. 세션 불일치, 누락 필드, 비FINAL, 기준가격 불일치, 이상 timestamp, 히스토리 선택에서 자동 참고값을 표시하지 않는다.
5. 남은 위험은 ① canonical 가격 자체의 독립 검증 부족 ② SOX 원천 미수집 ③ 신규 발행 때 market snapshot이 예외적으로 더 늦는 경우. ROY와의 별도 원천 분석: https://github.com/mauveplace/jjooni-control-tower/issues/454

## 테스트 및 출시 제한
- node --test tests/morning-brief-ui-contract.test.cjs: 실제 11/14 레이스, 동일세션/상태/가격 유효성, SOX 미합성, 비거래 reference label 테스트.
- Morning Brief Publication Contract PR CI + ROY 실댓글 검토 + main/Pages 실제 반영 확인이 완료되어야 운영적용 PASS.
- 신규 인증키·Cloud Run·직접 main 비검증 발행·자동매매·비공개 개인 계좌 관련 데이터는 사용하지 않는다.
