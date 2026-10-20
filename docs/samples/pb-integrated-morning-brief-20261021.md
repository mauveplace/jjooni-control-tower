# PB 통합 투자 인텔리전스 샘플 — 2026-10-21

> **SAMPLE / NOT LIVE**. 미국장 기준 2026-10-20. 기존 Observatory 2026-10-21 아침 시황 기록과 2026-10-21 공개 뉴스에 근거한 예시. Control Tower PB Snapshot/Brief/Health 실시간 접근 실패: snapshot_id, generated_kst, stale_after_kst, LIVE/STALE, decision_gate, source_health **재검증 불가**. 개인 계좌 사실·금액·현재 비중·현재 보유를 주장하지 않는다. 실제 주문/체결은 별도 실행계통 원천이 최종 권위.

## ① 한눈에 보는 결론 3줄
1. S&P500 약 +0.3%, Dow 약 +1%, Russell2000 +1.7%, Nasdaq100 -0.09%: 대형 기술주보다 헬스케어·가치주·소형주 순환이 강한 장세. [Reuters](https://www.reuters.com/world/asia-pacific/nasdaq-futures-dip-oil-prices-climb-earnings-loom-2026-10-20/)
2. AI 설비투자의 수익성과 차입 부담 논란 속 META·LRCX·TXN의 실적 가이던스가 핵심. [FXEmpire](https://www.fxempire.com/forecasts/article/the-week-ahead-meta-tesla-and-chip-earnings-put-ai-trade-to-the-test-1638768)
3. 현재 포트폴리오 사실은 PB LIVE 검증 전 단정 금지. 뉴스→시장 전달경로→실제 확인 노출→관찰 트리거로 분석한다.

## ② S&P500 시장 폭·섹터 — [Finviz](https://finviz.com/map?t=sec)
2026-10-20 미국장: 헬스케어·부동산·유틸리티 상대강세, 기술·커뮤니케이션 상대약세. [Reuters](https://www.reuters.com/world/asia-pacific/nasdaq-futures-dip-oil-prices-climb-earnings-loom-2026-10-20/). 1주·1개월 개별 수치는 이번 샘플에서 재검증하지 않음. [1주](https://finviz.com/map?t=sec&st=w1) · [1개월](https://finviz.com/map?t=sec&st=w4).

## ③ NDX/DXY/USD-KRW/US10Y — [TradingView](https://kr.tradingview.com/)
아래는 **2026-10-21 05:10 KST Observatory에 저장된 참고값**이며 이번 실행에서 재검증한 LIVE 시세가 아니다.

| 지표 | 저장 참고값 | 당시 변화 |
|---|---:|---:|
| NDX | 29,503.83 | -0.09% |
| DXY | 101.71 | -0.25% |
| USD/KRW | 1,325.88원 | -0.48% |
| US10Y | 약 5.10~5.12% | 원천별 컷오프 차이 |

달러 약세는 원화에 우호적일 수 있지만 높은 장기금리는 성장주 밸류에이션에 부담.

## ④ Nasdaq100 상위 10개 집중도 — [Slickcharts](https://www.slickcharts.com/nasdaq100)
기존 Observatory 10/21 저장값: 상위 10개 합산 **66.35%** (이번 실행 독립 재검증 전). 개별 ETF 중복노출 확인이 중요.

## ⑤ Fear & Greed — [CNN](https://edition.cnn.com/markets/fear-and-greed)
기존 Observatory 10/21 저장 참고값 **27/Fear**. 이번 샘플에서는 CNN 직접 추출 및 최신 미러 2곳 교차확인 미완료. 신규 검증값 아님.

## ⑥ 경제지표·실적 — [Finviz](https://finviz.com/calendar/earnings)
10/21 미국장 장후 META, TSLA, LRCX, TXN, IBM 등 실적 예정. [Investing 실적 달력](https://www.investing.com/earningscalendar/) · [발표 시간](https://www.nextearningsdate.com/calendar/). 경제일정은 [TradingView](https://kr.tradingview.com/economic-calendar/)에서 확인하며 미검증 시각·예상치는 기재하지 않음.

## ⑦ 통합 해석 / 오늘 대응전략 / Control Tower 참고
- **뉴스:** AI 투자 수익성·차입 부담. [Business Times](https://www.businesstimes.com.sg/international/ai-rally-wobbles-stock-markets-spotlight-turns-earnings)
- **전달경로:** AI 자본지출 기대 변화→GPU/반도체 장비/메모리 주문 전망 변화→전력인프라 투자 회수·신용비용 재평가→나스닥 메가캡 밸류에이션.
- **노출 분리:** 직접보유/ETF 간접노출/미보유 관찰종목은 실행 시 PB LIVE canonical SSOT로 검증 후 채운다. AI 반도체, HBM·범용 메모리, 전력인프라, 로봇은 각각 다른 경로로 분석한다.
- **현재 검증 상태:** PB Snapshot·Brief·Health 접근 실패. snapshot_id/generated_kst/stale_after_kst/LIVE·STALE/decision_gate/source_health **미확인**. 현재 NAV·현금·손익·레버리지·TRI-POD·계좌별 집중도 **판단 보류**.
- **트리거:** META AI CAPEX 대비 수익화, LRCX 장비 수요, TXN 산업 수요, US10Y 안정, 반도체 상승 종목 확산. 기존 매매전략·주문기준 변경 금지.
- **전일과 비교:** 10/20 대형주 중심 반등에 비해 10/21 보고 기준 헬스케어·소형주로 주도권 이동. 이것만으로 중기 Risk-on 확정 불가.
- **Observatory:** [2026-10-21 보관본](../market-observatory/data/morning-brief/20261021.json) 대신 저장소 루트 경로 `market-observatory/data/morning-brief/20261021.json` 참고. 시장 SSOT를 덮어쓰지 않는다.

## ⑧ 바로가기
[Finviz](https://finviz.com/map?t=sec) · [TradingView](https://kr.tradingview.com/) · [Slickcharts](https://www.slickcharts.com/nasdaq100) · [CNN](https://edition.cnn.com/markets/fear-and-greed) · [실적](https://finviz.com/calendar/earnings) · [Observatory](https://mauveplace.github.io/jjooni-control-tower/market-observatory/#morning-brief)

---
**PB 공용 샘플이며 LIVE 아침 시황을 대체하지 않음.** 게시 규격은 [morning-brief-publishing.md](../morning-brief-publishing.md), PB 핸드오프는 [pb-morning-intelligence-handoff.md](../pb-morning-intelligence-handoff.md) 참조.
