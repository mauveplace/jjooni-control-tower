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


## 6. V2.1 필수 모듈: 실적×섹터 자금흐름 (2026-11-15 이후 매일 상시)

형님 요청에 따라 **기존 8개 정규 제목은 그대로 유지**하면서 ④·⑤·⑦ 안에 아래 세 개의 표준 하위 제목을 매일 넣는다. 어느 하루에 실적 발표가 없더라도 ⑤를 생략하지 않고 최근 발표(7거래일)와 다가오는 발표를 점검한다. 상장사 실적을 보여줄 수 없으면 `NO_NEW_RELEASES` 또는 `SOURCE_UNAVAILABLE`과 실제 확인기간/사유를 적는다. **기업의 숫자와 투자자의 자금흐름은 별개 근거**로 판단한다.

### ④ **섹터 로테이션·자금흐름** — 매일 필수

미국/한국 장 기준일을 혼합하지 말고, 섹터별로 **1D·5거래일·20거래일 수익률, 벤치마크 대비 5일 초과수익(pp), 20일 평균 대비 거래대금/거래량, 실제 ETF 설정·환매 순유입/유출, 기관/외국인 수급(원문 확보 시), 데이터 기준시각**을 구분한다. 실데이터가 충분하면 7~10개 그룹을 고정 비교한다. **미국**: 반도체/장비, 클라우드·AI 플랫폼, 데이터센터 전력·냉각, 광통신·네트워크, 소프트웨어, 로봇/자동화, 금융, 헬스케어/방어주. **한국**: 반도체·장비, 전력기기, 로봇, 금융, 2차전지 등. 한 기업/ETF가 여러 섹터에 걸치면 섹터 합산 중복을 표시한다.

| 섹터 | 대표 벤치마크(예시) | 1D | 5D | 상대 5D (pp) | **실제 ETF 순유입** | 거래 활발도 | 판정/근거 |
|---|---|---:|---:|---:|---:|---|---|
| 반도체/장비 | SOX / SMH·SOXX | 출처값 또는 미확인 | 출처값 또는 미확인 | SOX vs NDX | **검증된 순설정/환매만 값** | 거래량 vs 20일 평균 | 강세/약세 및 선도기업 |
| AI 전력/냉각 | 해당 공개 ETF/업종지수 | … | … | … | 공식 수집 지연 시 `미확인` | … | 실적·수주와 정합성 |
| 광통신/네트워크 | 관련 업종/ETF | … | … | … | `미확인` 사유 | … | 동반 확산 여부 |
| 금융·방어/가치 | 금융·가치/방어 지수 | … | … | … | `미확인` 사유 | … | 위험회피 전환 여부 |

**절대 금지되는 잘못된 표현:** (1) ETF 가격 상승을 'ETF로 자금이 유입'이라고 서술, (2) 거래대금 증가를 '기관 순매수'로 서술, (3) ETF AUM 증가분을 순유입액으로 서술 (시장가격 상승·환율·설정/환매 혼재), (4) 여러 ETF 흐름을 상장주식의 실제 섹터 전체 유입액으로 확대, (5) 데이터 시차가 다른 미국/한국 흐름을 같은 거래일 숫자로 합산. **진짜 자금흐름**은 특정 ETF·펀드의 공식/명시된 설정·환매 순유입액이나 거래소/공식 기관·외인 순매수액을 근거·통화·기간과 함께 확인한 경우만 `DIRECT_VERIFIED`로 표기. 그렇지 않으면 `PRICE_VOLUME_PROXY` 또는 `UNAVAILABLE`; 자금 '이동'은 **추론**으로 분리.

### ⑤ **주요 기업 실적·가이던스** — 매일 필수

최근 발표기업 및 관찰기업에서 AI 밸류체인(반도체/장비, 메모리, 클라우드/플랫폼, 데이터센터·전력, 네트워크/광통신, 로봇)을 기본 우선순위로 선정. 우선 관찰 유니버스(해당 일에 실적 발표를 하지 않았으면 가장 최근 실적 발표일을 밝힌다): **NVDA, AVGO, AMD, MU, TSMC, ASML, AMAT, LRCX, KLAC, MSFT, GOOGL, AMZN, META, ORCL, ANET, VRT, ETN/GEV**, 한국 **삼성전자, SK하이닉스 및 해당 산업 주요 기업**. 매일 유니버스 전종목을 무리하게 장문으로 다루지는 않고 **당일 새 발표/핵심 이벤트 3~5건**, 주간 총괄(토요일)은 5~10건을 우선한다.

| 기업 / 발표일·실적분기 | 매출 / YoY | 시장 예상 대비 | EPS (GAAP/Non-GAAP 표시) | **가이던스 vs 예상** | CAPEX·수주·마진/FCF | 주가 반응* | 해석 |
|---|---|---|---|---|---|---|---|
| 실제 발표기업 | 공식 원문 | 컨센서스 출처·기준일 | 기준 명확히 | 상향/유지/하향 | 발표 근거 | 정규장/시간외·시각 구분 | 왜 반응했나 |
| 발표 없음 | `NO_NEW_RELEASES` | — | — | 가장 최근 확정 발표와 차이만 | 예정 공시 | — | 다음 확인 |

*실적 발표 뒤 주가 반응은 **발표 시각, 장중/장후, 비교 기준 종가, 거래소·통화·해당 반응 거래일**을 표시한다. 실적 서프라이즈는 실제값과 **동일 회계기준·기간·통화·공식 컨센서스 정의**가 있는 경우만 계산한다. 가이던스 상향이라고 표현하려면 이전 가이던스와 새 가이던스가 실제로 확인되어야 한다. 전년 대비 성장, 전분기 변화, 시장 예상 대비는 절대 혼합하지 않는다. 원문은 기업 IR/SEC·공시를 우선하고, 컨센서스는 별도 제공자·기준시각을 기록한다.

**고정 해석 4문장:** ① 결과는 무엇인가 (매출/EPS/마진 vs 기대), ② 시장이 진짜 민감했던 항목은 무엇인가 (CAPEX/주문/가이던스/FCF), ③ 실적 발표 후 가격이 실제로 어떻게 반응했나, ④ 그 변화가 **다른 AI 밸류체인**과 전력/네트워크/장비 주문에 어떤 전달 경로를 갖는가. 자료가 부족하면 `UNVERIFIED` 표시.

### ⑦ **실적×자금흐름 종합판정** — 매일 필수

| 실적/가이던스 | 자금 직접 관측·가격 상대강도 | 해석 | 다음에 검증할 조건 |
|---|---|---|---|
| 호조 | 직접 순유입 또는 확산 확인 | 이익과 자금이 동행하는 주도주 강화 가능성 | 이익 추정치·5D/20D 추세 지속 |
| 호조 | 상대약세/직접 유출 | 기대 선반영·밸류에이션 부담·리밸런싱 가능성 | 발표 전/후 가격과 유출 공시 분리 |
| 부진 | 상대강세/직접 유입 | 저점 기대·변화 선반영 가능성 | 가이던스/추정치 회복 여부 |
| 부진 | 상대약세·직접 유출 | 이익·수급 동반 약화 가능성 | 실적 하향 확산/신용 변화 |
| 자료 미확인 | 거래량·ETF 상대수익률만 존재 | `PRICE_VOLUME_PROXY_ONLY`, 진짜 유입/유출 불명 | 펀드 순설정/환매·기관 수급 공표 기다림 |

실제 ETF 순유입 지표가 없을 때도 **섹터별 등락/시장폭/상대강도 분석은 제공**하되, 표의 상태를 `PROXY_ONLY`로 표시한다. 주말 보고서는 5D 및 주간 실적을 기준으로 로테이션이 유의미하게 이어지는지 복기한다. 미래 가격이나 주문 수량, 포트폴리오 실제 보유 종목을 이 공개 보고서에서 임의로 단정하지 않는다.

### 발행 검사 및 2-AI 교차검토

2026-11-15 이후에는 섹션 ④에 **`**섹터 로테이션·자금흐름**`**, 섹션 ⑤에 **`**주요 기업 실적·가이던스**`**, 섹션 ⑦에 **`**실적×자금흐름 종합판정**`**을 반드시 넣는다. 실제 순유입 데이터가 없으면 `자금 직접 확인 불가`/출처 시차와 `PROXY_ONLY`를 표시하여 마치 수집된 것처럼 포장하지 않는다. ROY는 **실적 원문과 발표시각**, JJOONI는 **섹터 간 가격·자금 데이터 및 인과 해석**을 먼저 각자 확인하고 교차검토하되 어느 한쪽이 확인 못한 항목은 `PENDING`, AI 간 일치와 데이터 원천 독립성은 별도 기록한다.
