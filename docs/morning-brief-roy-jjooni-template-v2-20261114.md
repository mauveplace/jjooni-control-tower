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


## 6. 송팀장 반복 관심기업 + 섹터 2거래일 수익률 — 간소화 운영안 (사용자 확정 2026-11-14)

**이 절은 앞서 시도했던 복잡한 매일 ETF 순설정/환매·20일 수익률·섹터 랭킹·18개 기업 전수분석 초안을 대체한다.** 자세한 원문 회사명 집계와 단순 표는 [송팀장 전사본 6개 검토 관찰기업 목록](song-primary-companies-20261114.md)을 기준으로 한다. 이미 운영 중인 ①~⑧ 대분류를 변경하거나 기존 NDX/SOX 공식 종가·발행 시각 검증을 약화하지 않는다.

### ④ **섹터 강약 비교(전일→당일)** — 간단히 볼 시장 선호 변화

정확한 현지 거래일(미국 ET·한국 KST)을 별도 표기하고, 관측 가능한 **대표 섹터 4~6개**의 *직전 완료 거래일 수익률(%) → 최근 완료 거래일 수익률(%)*만 나란히 비교한다. **순위/5일·20일/ETF 설정·환매/기관수급은 매일 필수가 아니다.** 한 섹터는 같은 지수·ETF·대표 바스켓 정의의 두 날짜 수익률을 비교하며, 바스켓 구성이나 원천이 달라지면 비교불가를 표기한다.

| 섹터·대표 지표 | 전일 수익률 (%) | 당일 수익률 (%) | 변화(pp) | 한줄 해석 |
|---|---:|---:|---:|---|
| 반도체 — SOX | 확인값 또는 미확인 | 확인값 또는 미확인 | 당일−전일 | 강세/약세·방향 전환 |
| AI 클라우드·데이터센터 — 확인 가능한 대표 지표 | 확인값 또는 미확인 | 확인값 또는 미확인 | 당일−전일 | 시장 선호 변화 |
| AI 전력·냉각 — 확인 가능한 대표 지표 | 확인값 또는 미확인 | 확인값 또는 미확인 | 당일−전일 | 확산/차별화 |
| 빅테크 플랫폼 — 확인 가능한 대표 지표 | 확인값 또는 미확인 | 확인값 또는 미확인 | 당일−전일 | 실적 기대/조정 |
| 금융·방어 — 확인 가능한 대표 지표 | 확인값 또는 미확인 | 확인값 또는 미확인 | 당일−전일 | 위험선호 비교 |

`변화(pp) = 당일 수익률(%) - 전일 수익률(%)`이며, **상대강도 변화는 수익률 기반 추정**이다. 예를 들어 어제 -2%, 오늘 +1%이면 **+3%p 강도 개선**이지 3% 자금유입이 아니다. ETF 가격/거래대금만으로 **실제 순유입액·기관 순매수·전체 섹터 자금이동**을 주장하지 않는다. 실제 ETF 순유입이나 KR 기관 수급은 출처가 공식 검증된 특별한 날에만 **선택적 참고사항**으로 추가하며 기본 템플릿의 필수 수집 대상이 아니다. 시세 미수집 시 숫자를 채우지 않고 해당 행에 미확인 이유를 적는다.

### ⑤ **송팀장 관심기업 업데이트** — 반복 분석기업 중심 2~3개

최근 송팀장 6개 전사본에서 반복적으로 등장한 **NVIDIA(5/6), CoreWeave(4/6), Oracle(4/6), Nebius(4/6), Microsoft(4/6)**를 중심 관찰기업으로 둔다. Eaton·Micron·AMD 및 빅테크 연계 기업은 중요 실적·뉴스가 나온 날만 확장한다. 이 집계는 전사본 언급 빈도지 해당 기업에 대한 매수 추천·우량 판단이 아니다.

매일 **가장 중요한 2~3개 기업만** 아래 형태로 쓴다.

- **기업명·새 사실:** 실제 새 공시·실적·가이던스·수주·신용/차입·고객·경영진·주가 반응 중 무엇이 달라졌나?
- **송팀장 기존 관점:** 확인한 발언 기준일과 과거 해석(실제 원문이 없으면 **미확인**)
- **쭈니·로이 독립 점검:** 1차 발표자료, 날짜, 확인된 숫자와 반대 해석
- **다음에 볼 조건:** CAPEX→매출/FCF, 전력, 신용, 수주·수익성 등 관련 검증 지표

실적이 발표된 날에는 **매출/EPS(회계기준)·가이던스·CAPEX·실적 후 주가 반응** 중 실제 확인된 핵심 항목만 추가한다. 유료 컨센서스가 없으면 시장 예상 대비 서프라이즈율을 만들어내지 않는다. 새 이슈가 없으면 `NO_MATERIAL_CHANGE`와 최근 점검 이슈/다음 공시를 간단히 기재한다. 기업 18개를 매일 채우는 것이 목적이 아니다.

### ⑦ **기업·섹터 연결 해석** — 매일 2~3문장

① **기업 실적·공시의 방향**, ② **해당 섹터의 전일→당일 상대강도**, ③ **동행/엇갈림에 대한 가설과 반론·다음 확인**을 연결한다. '자금이 몰렸다' 대신 '이틀 수익률상 반도체 선호가 강화된 *것으로 해석할 여지가 있다*'처럼 근거 수준을 구분한다. 개인 보유·매매 여부, 공식 종가 미검증을 임의로 승격하지 않는다.

### 최소 발행 검사

2026-11-15 이후 V2 신규 보고서 ④에 `**섹터 강약 비교(전일→당일)**`와 전일·당일·변화(pp) 헤더가 있는 2일 비교 표 및 `수익률 기반 추정`이라는 명시가 있어야 한다. ⑤에 `**송팀장 관심기업 업데이트**`, ⑦에 `**기업·섹터 연결 해석**`을 두고, 새 이슈가 없더라도 실제 점검 범위를 적는다. **이 세 가지 제목과 표 형식만 최소 검증**한다. 실질 숫자와 기업 주장·출처 검증은 원래 V2의 ② 원장 지표·③ 사건·⑧ 감사 절차를 유지한다. 새로운 `sector_flows[]`, `earnings_events[]` **필수 의무는 없다.**

이 단순화는 로이의 [1차](https://github.com/mauveplace/jjooni-control-tower/pull/462#issuecomment-6867767556)·[2차](https://github.com/mauveplace/jjooni-control-tower/pull/462#issuecomment-6867900893) 검토에서 확인된 **동일 날짜 자유 텍스트만으로는 실제 ETF 자금유입을 확정할 수 없고, 다수의 복잡한 증빙 조건이 정상 보고서까지 막는 문제**를 피하기 위한 **사용자의 후속 방향 결정**이다. 로이가 단순화 코드의 최종 HEAD에 PASS를 남겼다고 주장하지 않는다.
