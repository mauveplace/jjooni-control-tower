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
