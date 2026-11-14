# ROY × JJOONI 일일시황 공통 템플릿 V2 — 2026-11-14

**목적:** ChatGPT(JJOONI)와 Claude Code(ROY)의 독립 시황을 **동일 완료 미국장 세션**에서 대조하고, 누락된 핵심 숫자를 발견·보완하며 실제 독립 원천 검증과 단순 두 AI 간 의견 일치를 엄격히 구분한다. 본 문서는 공개 시장분석 전용이며 개인 계좌·트레이딩 엔진에 대한 읽기/쓰기 권한을 만들지 않는다. 원본 자동화 일정은 뉴욕 16:45 ET(2026-11-14 조정)이며, 사용자가 임의로 실행/병합을 승인했다고 간주하지 않는다.

## 0. 두 개 AI 보고서의 진실성

- **JJOONI 보고서 원본:** `market-observatory/data/morning-brief/YYYYMMDD.json` (현재 날짜별 Archive/Latest/Index).
- **ROY 독립 분석:** 공개 GitHub Issue/PR의 **실제 Claude GitHub 앱 원본 코멘트**나 별도 검증 가능한 아티팩트로 확인된 경우에만 `ROY_REVIEWED`. GitHub에 ROY 별도 날짜별 시황이 없으면 `NOT_FOUND`, ROY가 실제 댓글을 남기지 않았다면 `PENDING`. Claude 라벨을 사람이 쓴 것처럼 위장하거나 GitHub 작성자명만으로 신원 인증하지 않는다.
- `MATCH`는 **설명/수치 일치**, `DISAGREE`는 **분석 차이**, `UNVERIFIED_COMMON`은 **두 분석이 똑같이 미검증 주장**, `INCOMPARABLE`은 세션·상품·정의·자료 빈티지가 서로 다른 것. **두 AI가 동의했다고 가격의 독립 교차검증이 되는 것은 아니다.**
- 공개본은 아침 **시점 고정 독립판**, 후행 ROY 리뷰는 별도 수정 이력으로 기록한다. ROY 후행 의견을 06:30 당시 이미 확인한 척 원본에 끼워 넣지 않는다. 전사본/플라우드 관련 비공개 식별정보는 절대 GitHub에 공개하지 않는다.

## 1. 모바일 8줄 요약 (본문 앞)

`기준일(KST)` / `완료 미국장 세션(ET)` / `원천 원본 생성 시각(KST)` / `공식 NDX/SOX 검증` / `일반 시장 판정` / `핵심 이유 2건` / `관측할 조건 2~3개` / `NO_TRADE_REVIEW_ONLY`. 가장 최근의 `generated_kst`가 아닌, 실제 보고서가 읽은 `editorial_contract.canonical_source_vintage`를 먼저 표시한다. 기다리던 원장이 원문 발행 뒤 도착했다면 **후속 보강**으로 따로 공개한다.

## 2. 기존 V1의 정확한 섹션 제목 8개 (불변)

| 제목 | 템플릿에 추가할 내용 |
|---|---|
| `## ① 오늘의 시장 이야기` | 오늘 변화 2~3문장, **검증 사실/추론/반론** 분리. 뒤늦게 갱신된 데이터가 있다면 원래 작성 시각과 구별 |
| `## ② 시장 한눈에` | **단일 숫자 표**: NDX / SOX / S&P500 / VIX(수준) / VIX10 / MA250 / 52주 고점 대비 DD, 미10년물(bp), USDKRW, KOSPI/KOSDAQ. `수준·1D·1W·1M·3M·세션/원천·상태`. 값이 없으면 이유를 공개, 동일 원장 참조값을 공식 EOD로 승격하지 않음 |
| `## ③ 핵심 이슈 깊이 읽기` | 중요도 높은 3~5개(중요 시 확대). 각 이슈 **핵심 숫자 / 무슨 일이 / 왜 중요 / 반대 해석 / 다음 확인**을 모두 포함. 뉴스→금리·달러·신용→산업/기업으로 실제 관측과 가설 구분 |
| `## ④ 글로벌·한국 시장` | 한국·아시아 **각 지역 현지 날짜**와 미국장 날짜 분리. KRX 공식 수급 / 외인·기관, 시장폭, TAIEX/닛케이/홍콩 등 필요 시. 출처 충돌은 수치 병기와 `CONFLICT` |
| `## ⑤ AI 산업·기업실적` | 반도체/메모리/전력/데이터센터/광통신, 실적과 지침, 주문·매출·FCF 연결. 이벤트 발생일/실적발표일 구분. 실제 보유 현황 단정 금지 |
| `## ⑥ 주요 일정` | 1주 이벤트, KST/ET 양방향 확인, 예정/발표/휴장과 컨퍼런스콜 구분, 검증 공식 소스 |
| `## ⑦ 투자전략·위험점검·복기` | 분석용 조건부 시나리오(트레이딩 신호 아님), 전일 고정 가설에 대한 결과, **ROY vs JJOONI 5축 비교**(방향, 원인, 산업, 리스크, 다음 조건) 및 ROY 미응답 시 PENDING |
| `## ⑧ 원천·데이터 감사` | **원천 세션/비교 시각/빈티지/결측 이유**, 공식 종가 이중검증 여부, ROY 실제 코멘트 링크·작성 앱 확인·차이 및 다음 보완 과제, 원본/수정 원문 구분, PR→CI→main→Pages 각각 상태 |

기존 `SONG_INSPIRED_DAILY_V1` JSON과 `JJOONI_MORNING_BRIEF_V1` 스키마, 8개 정확한 제목, 개인정보 차단·비거래 원칙, 신규 후보 PR→CI→병합→Pages 검증을 유지한다.

## 3. 핵심숫자 정합성 표준 (신규 공개 시황 2026-11-15부터)

`editorial_contract`에 버전 `template_version="ROY_JJOONI_DAILY_V2"`를 추가하고, 다음 **5개 필수 핵심지표** (`NDX, SOX, VIX10, MA250, DD52W`)와 선택사항 `SP500`을 `market_metrics`로 기록한다.

```json
{
  "template_version": "ROY_JJOONI_DAILY_V2",
  "market_metrics": {
    "NDX": {"value": 27943.7363, "status": "PROVIDER_REFERENCE_ONLY", "session_date": "2026-11-13", "source": "Observatory (Yahoo ^NDX)", "source_generated_kst": "2026-11-14T07:41:26+09:00", "official_eod_verified": false, "trade_signal_eligible": false},
    "SOX": {"value": 10146.3232, "status": "PROVIDER_REFERENCE_ONLY", "session_date": "2026-11-13", "source": "Yahoo ^SOX single provider", "source_generated_kst": "2026-11-14T07:41:26+09:00", "official_eod_verified": false, "trade_signal_eligible": false},
    "VIX10": {"value": 20.73, "status": "PROVIDER_REFERENCE_ONLY", "session_date": "2026-11-13", "source": "Observatory same-session calculated", "source_generated_kst": "2026-11-14T07:41:26+09:00", "official_eod_verified": false, "trade_signal_eligible": false},
    "MA250": {"value": 27505.8, "status": "PROVIDER_REFERENCE_ONLY", "session_date": "2026-11-13", "source": "Observatory same-session calculated", "source_generated_kst": "2026-11-14T07:41:26+09:00", "official_eod_verified": false, "trade_signal_eligible": false},
    "DD52W": {"value": -10.51, "status": "PROVIDER_REFERENCE_ONLY", "session_date": "2026-11-13", "source": "Observatory same-session calculated", "source_generated_kst": "2026-11-14T07:41:26+09:00", "official_eod_verified": false, "trade_signal_eligible": false}
  },
  "dual_review": {"review_status":"PENDING","roy_report_status":"NOT_FOUND","roy_issue_url":null,"reviewed_source_session":"2026-11-13","comparison":[ ],"verified_by_independent_provider":false}
}
```

위 수치는 **2026-11-14 후속 원장 참고값을 보여주는 형식 예시**이지 미래 시황 생성 시 그대로 복사하는 고정값이 아니다. 매일 새로 읽은 원천 값을 저장한다. `status` 값은 `OFFICIAL_VERIFIED / PROVIDER_REFERENCE_ONLY / MISSING / CONFLICT` 중 하나. MISSING/CONFLICT는 `value=null`과 `reason` 필수. 세션 일치 + 공식 종가 검증 미완이면 관측값을 숨기지 않고 `PROVIDER_REFERENCE_ONLY` + `trade_signal_eligible=false`로 표시한다. 두 파생 JSON 일치는 공식 독립 소스 두 개로 인정하지 않는다.

## 4. ROY ↔ JJOONI 실제 상호 검증

기계적 게이트는 **두 사람의 승인 도장**이 아니라 **증거 비교**이다.

1. **사실 출처:** 서로 독립적으로 제출한 주장별 `claim_id, session, value, unit, original_source_url, observed_at, official_status`를 정렬.
2. **비교 대상:** US 시장 가격·시장폭; 물가·금리·환율; AI CAPEX/실적 뉴스 및 발생 시점; 한국/아시아; 위험·반론·다음 확인. 날짜나 상품이 다르면 `INCOMPARABLE`.
3. **판정:** `MATCH / COMPLEMENT / DISAGREE / UNVERIFIED_COMMON / INCOMPARABLE`. 숫자가 일치해도 같은 Yahoo 데이터를 다시 인용했으면 `source_independent=false`. 공식 종가와 충돌하면 가격 이슈만 보류, 나머지 사실은 살아 있게.
4. **시각 경계:** 아침 최초 발행본을 절대 소급 작성하지 않는다. ROY가 사후에 검토하면 `PENDING → REVIEWED`를 *추가 기록*하고 날짜별 최초판은 `revisions`에 원본/새 주장과 근거 링크/시각 포함.
5. **구조적 누락 처리:** 신규 발행 시 5대 핵심지표가 현재 같은세션 Glance 원장에 존재하는데 `MISSING`이면 **발행 차단**. 데이터를 확보하지 못했다면 왜 없는지를 필드별로 설명하고 `PENDING` 처리. `OFFICIAL_VERIFIED`는 엄격 `close_checks` 공식 근거가 실제로 있을 때만 인정한다.
6. **미응답:** 로이가 응답하지 않아도 일일시황 **독립 원장 검증까지 된 자료만** 발행하고 `dual_review.review_status=PENDING`으로 남긴다. 임의 ROY 승인·상호검증 완료로 표기 금지. 후행 비교는 동 세션에 연결한다.

## 5. 테스트·자동화 및 출시 게이트

- `tools/validate_morning_brief.py`가 **2026-11-15 이후** 신규 보고서에 5대 지표 상태와 `dual_review`를 검증, 구버전 보관본에는 소급 강제하지 않는다.
- `tools/check_morning_brief_readiness.py`가 actual Glance·Pulse·Observatory 완료 세션과 시각·빈티지·숫자 정합성 검사. **현재 원장에 있는 NDX/SOX/VIX10/MA250/DD가 문서상 공란이면 CI 실패**. SOX 선택 수집 실패는 명시적 MISSING만 통과.
- 시황 자동화는 **ChatGPT 시황 초안→원장 완결성 게이트→후행 ROY 실제 검토/차이 메모→한 번만 발행 또는 정정**. 로이가 생성한 별도 독립 요약이 없으면 PENDING을 공개하고 ROY 보고서가 존재한다고 주장하지 않는다.
- ROY 실제 검토는 GitHub 앱의 `performed_via_github_app.slug='claude'` 또는 독립 검증 가능한 세션·댓글과 원본 ID로만 입증; 마지막 검토의 HEAD가 다르면 그 검토는 현 HEAD의 PASS가 아니다.
- 개인 거래·AI_AUTOBOT·Control Tower 비공개 SSOT·계좌·원금·주문·비밀키를 다루지 않는다.

변경 이력은 이 문서와 관련 PR, [ROY 공동 분석 요청 #458](https://github.com/mauveplace/jjooni-control-tower/issues/458)에 남긴다.


## ROY 1차 검토 반영 — 2026-11-14 08:09 KST 이후

[ROY 첫 실댓글](https://github.com/mauveplace/jjooni-control-tower/pull/459#issuecomment-6867212874)에서 **실제 독립 시황 작성은 접근 가능한 외부 완료세션 원천 부족으로 BLOCKED**였고 기존 GitHub canonical만 대조할 수 있었다고 명시했습니다. 따라서 서로 다른 AI가 같은 원장 숫자를 낭독한 것을 **독립 시황과 가격 검증이 완료된 것**으로 표시하지 않습니다. 기존 `dual_review.review_status=PENDING`은 ROY의 진짜 독립 세션 분석 및 원본 주장 대조가 완료될 때까지 유지합니다.

- ② 공개 숫자표의 핵심 5개 행은 `market_metrics` 숫자의 **소수 둘째 자리 표기**와 직접 일치해야 합니다. JSON만 정상이고 본문에 `미확인` 또는 엉뚱한 숫자가 남아 있으면 발행을 차단합니다. 결측은 해당 행에 `미확인 + 이유`를 명시합니다.
- `VIX10/MA250/DD52W`는 원장 파생지표이므로 `OFFICIAL_VERIFIED` 금지. `PROVIDER_REFERENCE_ONLY / MISSING / CONFLICT`만 허용합니다. NDX/SOX도 공식 independent `close_checks.status=VERIFIED`가 없으면 `OFFICIAL_VERIFIED` 불가.
- ROY `REVIEWED`의 **형식 검사**는 `/mauveplace/jjooni-control-tower/(issues|pull)/<번호>#issuecomment-<번호>` 등의 같은 레포 원본 **댓글 ID**, 실제 GitHub Claude 앱 식별 필드 `roy_github_app='claude'`, `roy_comment_id` 일치, `comparison`의 `claim / outcome / session_date / roy_source / jjooni_source / source_independent` 필수. 판정 값은 `MATCH / CONFLICT / COMPLEMENT / UNVERIFIED / INCOMPARABLE`. **이 검사는 URL 형식만 확인**하며 인터넷에서 그 댓글의 작성자를 인증할 수 없습니다. 따라서 `REVIEWED`로 바꾸기 전에 담당 AI가 원본 GitHub API `performed_via_github_app.slug='claude'`, 원본 댓글 ID, 동일 완료 세션, 실제 ROY 독립 분석 문장을 별도로 조회·확인해야 합니다.
- `2026-11-14 07:45`는 **원장 생성 시각**, `08:02`·`08:09` 등은 **사후 보고서 검토/보강 시각**입니다. 원문 최초 발행은 `06:32:48`로 보존합니다.


## 6. 형님 최종 지정: 기존 「송팀장 Sector Observatory」 세로 보드 기반 일일시황 (2026-11-14)

**이 절은 앞서 제안한 'NVIDIA·CoreWeave 등 특정 5개 기업 고정 추적'과 '반도체·AI 4~6개 업종만 선택'하는 규칙을 전면 대체한다.** 형님이 직접 보고 지정하신 것은 실제 운영 [섹터·ETF 탭](https://mauveplace.github.io/jjooni-control-tower/market-observatory/#sectors)의 **「송팀장 Sector Observatory → 시장의 방향 · 섹터별 등락」** 세로형 등락 보드다. 새로운 섹터·ETF 분류표를 만들지 않고 현재 `market-observatory/sector-etf-v1.js`의 **11개 S&P500 섹터, 한국 KRX 섹터 ETF 10개, 주요 테마 ETF 13개(6개 그룹)**를 사용한다. 원본 소스는 기존 `market-observatory/data/sector-etf.json` 단 하나다.

### 원장 연결 — 추가 시세 API 호출 금지

- 기존 섹터 데이터 수집 작업은 원래대로 실행한다. 원장 수집 직후 **추가 API 없이** `tools/build_sector_rotation_brief.py`로 `market-observatory/data/sector-rotation-brief.json` (약 17KB) 요약을 자동 생성해 **같은 GitHub 커밋으로 함께 공개**한다.
- 이 작은 파일은 원본과 동일한 완료 일봉, 시장별 완료 기준일 `completed_cutoffs.US/KR`, 원본 `source_generated_kst`를 보존한다. 데이터는 미국 11개, 한국 10개, 테마 13개를 고정 출처에 따라 담는다. 국적·섹터가 겹치는 ETF는 서로 다른 업종 현금 유입으로 더하지 않는다.
- 날짜별 실제 비교는 **연속된 원장 바 3개**로 계산한다. 직전 거래일 수익률 = (전전일→전일), 당일 수익률 = (전일→가장 최근 완료 거래일). `변화(pp) = 당일 수익률 - 전일 수익률`. 월요일은 전 영업일인 금요일과 목요일을 사용한다. `source_row.ret_1d_pct`와 0.05%p 이상 충돌하면 해당 지표는 **MISSING/불일치**로 처리한다.
- 장 마감이 아닌 현재가·미완성 일봉은 사용하지 않는다. 시장별 `completed_cutoffs`와 `observed_date`가 다르면 **MISSING_OR_STALE_BAR**로 기록한다. US·KR 장 날짜는 따로 기재한다. NDX/SOX 공식 EOD 독립검증과는 별도 참고 데이터이며, **실제 자금 순유입/기관 순매수액은 아니다.**

### ④ 글로벌·한국 시장 — 기존 세로 보드 그대로

**표준 소제목: `**송팀장 Sector Observatory · 전체 업종 강약**`**

해당 소제목 바로 아래에 다음 세 그룹을 **세로 목록/세로형 막대**로 보여준다(가로로 길게 늘어뜨리는 새 5개 섹터 카드 금지).

1. **미국 S&P500 11개 업종:** XLK 기술 · XLC 커뮤니케이션 · XLY 경기소비재 · XLF 금융 · XLI 산업재 · XLE 에너지 · XLB 소재 · XLV 헬스케어 · XLP 필수소비재 · XLU 유틸리티 · XLRE 부동산.
2. **한국 10개 섹터 ETF:** 091160 반도체 · 091170 은행 · 091180 자동차 · 102960 기계장비 · 117460 에너지·화학 · 117680 철강 · 117700 건설 · 140700 보험 · 266360 미디어/엔터 · 266410 필수소비재.
3. **기존 주요 테마 ETF:** 반도체(SMH, SOXX), 소프트웨어·클라우드·사이버(IGV, SKYY, HACK), 바이오(XBI), 지역은행(KRE), 방산·인프라·에너지(ITA, XAR, PAVE, XOP), 로봇(BOTZ, ROBO).

각 행의 표시 형식: **섹터명 · 티커 | 전일 −0.00% → 최근 완료일 +0.00% | 변화 +0.00%p | 전환/강세지속/약세지속**. 원본 세로 보드처럼 각 국가군의 당일 수익률을 기준으로 시각적으로 위/아래 정렬할 수 있으나, **일일시황에 새로운 5D/20D/순유입 순위 수집을 추가하지 않는다.** 수치 없는 행도 `미확인(원장 지연)`으로 남긴다. UI에서 이미 완성된 막대·세로 목록과 같은 구조를 답습하며 새로운 4~6개 선택형 섹터만 보여주는 가로 테이블로 후퇴하지 않는다.

**해석은 전체를 계산한 후 변화를 주도한 2~4개 업종만 한두 문단으로 설명한다.** 예시(실제 11월 12→13 원장):
- 미국 기술 XLK −0.34%→−2.01% 약세 심화, 필수소비재 XLP −0.43%→+1.42%, 금융 XLF −0.72%→+0.81%, 헬스케어 XLV −0.59%→+0.54% 반등.
- 한국 반도체 091160 −0.75%→−0.84% 약세 지속, 건설 117700 −1.10%→+1.88%, 은행 091170 +0.38%→+3.20% 상대강도 개선.
- **시장 선호가 기술에서 방어·금융, 한국에서 건설·은행 쪽으로 '기울어 보인다'**는 수익률 기반 해석은 허용한다. **'실제로 자금이 해당 섹터로 순유입됐다'**는 미확인 단정은 금지한다. 사후 업종별 수급 원문이 있다면 별도 근거·날짜로 해석을 보완한다.

### ⑤ AI 산업·기업실적 — **시장의 중대 기업 이벤트가 발생했을 때만 분석**

**고정 추적 기업 자체가 없으며 송팀장 기존 관심기업의 포함 여부가 발굴의 전제조건이 아니다.** 이 섹션은 송팀장 과거 분석에서 거론된 기업뿐 아니라, **현재 시점의 NASDAQ-100 구성기업 전체를 포함한 미국·한국 주요 기업** 및 시장을 실질적으로 흔드는 비지수 기업에 적용한다. 실적이 없어도 대형 사건이 있을 수 있다. 기업명을 매일 2~3개 의무로 채우지 않고 **중대한 이벤트를 확인한 경우만 사건의 중요도에 따라 0~5개** 다룬다.

**표준 소제목 `**시장 전체 주요 기업 이벤트 · 발생 시 분석**`** 아래에 먼저 스크리닝 범위/조회 완료시각·범위의 제약을 기재하고, `MATERIAL_EVENTS_FOUND`, `NO_MATERIAL_EVENTS_CONFIRMED` 또는 `SCREENING_INCOMPLETE` 중 실제 증거에 맞는 상태를 기재한다. `NO_MATERIAL_EVENTS_CONFIRMED`는 실질적으로 확인한 뉴스·기업공시 범위 안에서만 적용하며 미국 기업 100개를 하나하나 모두 감시했다고 거짓 주장하지 않는다.

**탐지 범위:**
1. **나스닥100 최신 구성기업:** 실적·가이던스 급변, CEO/CFO 사임·교체, 조사·소송·제재, 대규모 인수합병, 핵심 제품 출시/리콜/금지, 공급 차질, 신용·유동성, 대형 고객 계약, 임상·특허, 사이버보안 사고 등 시총·지수·업종 파급사건. 이슈가 있다면 과거 송팀장이 언급하지 않은 기업도 반드시 선정 후보.
2. **미국 전체 S&P500 주요기업·업종 이슈:** 기존 11개 업종 보드와 맞물리는 실적/정책/구조변화·시장급등락. 업종에서 움직임이 가장 컸거나 산업의 변곡점을 설명할 수 있는 기업을 우선.
3. **한국/글로벌 기타 주요기업:** KRX 전체 업종 비교에서 부각된 건설·은행·바이오 등도 포함하고 한국 주식·ADR·해외 유의미 업체를 배제하지 않는다.
4. **송팀장 당일 새 시황·Plaud:** 실제 확보된 발언·전사 내용을 참조해 기존 관점과 달라진 가설을 비교한다. 송팀장 분석자료가 없어도 **독립적으로 뉴스·공시 탐색은 계속**한다. 역사적 관심기업 목록을 매일 고정해서는 안 된다.

**스크리닝 순서:** 대형지수 급변 및 주요 11개 섹터 변동 확인 → 공식 기업 실적·기업 IR/SEC/DART/KIND, 주요 뉴스/정책·경제 일정, 시총 상위·대형 변동 기업에서 사건 후보 추출 → 원본 일자·실제 발표/뉴스 시각·해당 시장 세션 확인 → **시장 파급력·새로움·검증성**으로 선별. 고정 수치 임계값은 후보 발굴 *참고*일 뿐, 변동폭이 8%를 넘었다고 자동 호재/악재로 판정하지 않는다. 대형 기업의 CEO 사임·합병은 가격 변동이 적어도 포함될 수 있다.

**선별된 중요 기업은 한 개당 5단계 짧은 사건 카드:**
- **확정된 사건**: 무엇이 실제 발생했는지 (회사/공식기관 원문, 시각, 회계기간, 당일/사전 사건 여부)
- **주가·시장 반응**: 해당 회사와 소속 11개 업종/연관 주요 테마, 지수 영향. 가격만으로 인과를 확정하지 않음
- **이익 × 평가배수**: 변화가 영업이익/매출·현금흐름 예상인지, 금리·위험프리미엄·장기 성장 기대를 통한 주가 평가배수인지, 또는 복합인지 구분
- **전파 경로·반론**: 공급망·고객·경쟁사·대출/신용·다른 업종, 확인되지 않은 가설/대안 설명 구분
- **다음 확인**: 예정 공시/당국 발표/가이던스·실적/주가·업종 재검증 조건 1개 이상

회사 숫자/CEO/SEC 조사 같은 핵심 사실은 **직접 확인 가능한 공식 원천·일자·발표주체를 우선**하고, 송팀장 코멘트 및 기사 해석은 별도 레이어로 둔다. 유료 컨센서스가 없으면 서프라이즈율을 만들지 않는다. **사건이 없으면 기업 상세 카드를 만들지 않고**, ⑤에 확인 범위·실제 상태·다음 일정만 한두 문장으로 기록한다.

**Plaud의 송팀장 최근 3개 시황 및 「시장읽기 11강: 섹터와 산업」을 확인한 분석 원칙:** S&P500 11개 업종은 기업 업종명보다 **실제 이익 창출원**을 이해해야 하며, 기업의 주가는 설명모형으로 `이익 × 평가배수`의 변화로 바라본다. 에너지·메모리 등 경기민감 산업은 실적 민감도, 성장·유틸리티 등 일부 산업은 금리/평가배수 민감도를 강조한다. 사건 후 주가가 기대와 다르게 움직이는 경우 **실적 수치뿐 아니라 자금조달·이자비용·계약의 매출 전환·사업위험**을 검토한다. 2거래일 업종 강약은 관측 사실이지 업종 자금 순유입의 독립 증명이 아니며 매매 규칙으로 승격시키지 않는다. **Plaud 녹취 속 미검증 발언·추론을 사실로 자동 인정하지 않는다.** 원본 개인 녹음 링크나 내용을 공용 Repo에 그대로 복사하지 않는다.

### ⑦ 투자전략·위험점검·복기 — 업종 변화에 대한 조건부 원인 해석

**표준 소제목: `**업종 주도권 변화 · 원인과 다음 확인**`**. 아래 네 가지를 연결한다.
① 어떤 업종이 **전일 대비 방향을 전환/지속**했는가.
② 기술·반도체·금융·건설·헬스케어 등 전체 업종 비교에서 상대적 **선호 이동으로 보이는 관측**은 무엇인가.
③ 금리·성장·기업 실적·정책 등 어떤 **가설**이 설명할 수 있고, 반대 해석은 무엇인가.
④ 다음 거래일에 그 해석을 **검증할 시장폭/업종 등락/실적 이벤트**는 무엇인가.

모든 8개 섹션 및 기존 핵심 시장지표·원천 생성시각·NO_TRADE/개인정보·ROY 실제 댓글 검증은 그대로 유지한다. ROY가 아직 이 최종 코드 HEAD를 독립 검토하지 않았다면 `PENDING`을 표시한다.

### 새 보고서의 최소 검증

2026-11-15 이후의 ④에는 `**송팀장 Sector Observatory · 전체 업종 강약**`, `미국 S&P500 11개 업종`, `한국 10개 섹터 ETF`, `주요 테마 ETF`를 모두 포함한다. **미국 11개 XL 코드·한국 10개 KR ETF 코드·기존 테마 13개 코드**가 세로형 각 행에 모두 보여야 한다(원장 결측이면 숫자는 미확인으로 표시). ⑦에는 `**업종 주도권 변화 · 원인과 다음 확인**`, ④에는 반드시 `수익률 기반 추정`이라는 사실 한계를 넣는다. ⑤ 특정 기업명과 관련 회사 수는 강제하지 않는다. 다만 `**시장 전체 주요 기업 이벤트 · 발생 시 분석**`과 실제 스크리닝 범위·결과 상태(`MATERIAL_EVENTS_FOUND/NO_MATERIAL_EVENTS_CONFIRMED/SCREENING_INCOMPLETE`)는 반드시 남긴다. Nasdaq100의 중요 이벤트를 송팀장이 과거에 언급한 기업이 아니라는 이유만으로 버려서는 안 된다. 새로운 출처·가짜 유입액·기존 섹터 임의 축소는 금지한다.
