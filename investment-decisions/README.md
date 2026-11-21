# Investment Decision Ledger (공개 판단 원장)

JJOONI·ROY의 투자 판단을 **기록 → 사후 검증 → 개선**으로 연결하는 정형 원장입니다.
토론은 GitHub Issue, 정형 기록은 이 폴더의 JSONL, 규칙·코드 변경은 PR로 분리합니다.

> 이 저장소는 **공개**입니다. 계좌 잔액, 보유 종목·수량, 평균 매입가, 손익, 주문·체결 내역은 절대 기록하지 않습니다.
> 그런 정보는 Control Tower 인증 영역에서만 조회합니다. `tools/decision_ledger.py`가 금지 키·문구와 자유문장 속 수량(`N주`, `N shares`)·금액(`N만원`, `N억원`, `₩N`) 패턴을 CI에서 차단합니다.
> 이 검사는 보조 장치입니다. 목록에 없는 표현은 놓칠 수 있으므로, 작성자와 리뷰어가 최종 확인합니다.

## 구조

```text
investment-decisions/
  <YYYY>/<MM>/daily-decisions.jsonl   # 판단 1건 = 1줄 (append-only)
  <YYYY>/<MM>/outcome-reviews.jsonl   # 사후 평가 1건 = 1줄 (append-only)
  weekly/<YYYY>-W<ww>.md              # 주간 판단 성적표
  monthly/<YYYY>-<MM>.md              # 월간 판단 성적표
```

## daily-decisions.jsonl 필드

| 필드 | 필수 | 설명 |
|---|---|---|
| `decision_id` | ✅ | `YYYY-MM-DD-NN`. 날짜는 `kst` 날짜와 같아야 하고, 파일이 있는 월 폴더와 일치해야 함 |
| `kst` | ✅ | 판단 확정 시각, `+09:00` |
| `topic` | ✅ | 판단 주제 (예: `TRI-POD signal`) |
| `final` | ✅ | 최종 결정 문장 |
| `status` | ✅ | 아이디어 자체의 상태: `ADOPTED` / `RESEARCH` / `REJECTED` / `SUPERSEDED` / `HOLD` |
| `consensus` | ✅ | **AI 합의** 상태: `AGREED` / `PARTIAL` / `DISAGREED` / `SINGLE_AGENT` |
| `owner_decision` | ✅ | **형님 승인** 상태: `APPROVED` / `REJECTED` / `PENDING` / `NOT_REQUIRED`(신호 시스템 자동 판정 등) |
| `execution` | ✅ | **실제 집행** 상태: `EXECUTED` / `NOT_EXECUTED` / `NOT_APPLICABLE`. `EXECUTED`는 `owner_decision=APPROVED`일 때만 허용 |
| `review_at` | ✅ | 사후 평가 시점 목록(중복 금지). `T+1`, `T+5`, `T+20` 또는 `next NO-POD` 같은 이벤트. `T+0`은 허용하지 않음 |
| `inputs` | | 판단 당시 공개 시장 수치 (지수, VIX, 이동평균 등) |
| `inputs_meta` | `inputs`가 있으면 ✅ | `source`(비어 있으면 안 됨), `observed_at_kst`(관측 시각, **판단 시각 이후면 실패** = 미래 데이터 금지), `verification`(`INDEPENDENTLY_VERIFIED` / `SINGLE_SOURCE` / `UNVERIFIED`). 지표마다 출처·시각이 다르면 `fields: {지표키: {source, observed_at_kst}}`로 개별 기록 |
| `jjooni` / `roy` | | 각자의 의견 |
| `dissent` | | 남은 이견 |
| `rationale` | | 근거 요약 |
| `supersedes` | | 이전 판단을 바꿀 때 대상 `decision_id`. **기존 줄은 수정하지 않고 새 줄을 추가** |
| `sources` / `source_issue` | | 출처 URL 목록 / 토론 Issue 번호 |

## outcome-reviews.jsonl 필드

| 필드 | 필수 | 설명 |
|---|---|---|
| `decision_id` | ✅ | 평가 대상 판단 (원장에 존재해야 함) |
| `horizon` | ✅ | 해당 판단의 `review_at`에 있는 값만 허용. 같은 판단·같은 시점·같은 `outcome_basis` 평가는 1건만(실제와 가상은 각각 1건씩 가능) |
| `asof_kst` | ✅ | 평가 시각. 판단 시각 이후이고, `T+N`이면 `matured_session_date` 장 마감(미국 16:00 ET, KRX 15:30 KST) 이후여야 함 |
| `verdict` | ✅ | `CORRECT` / `INCORRECT` / `MIXED` / `NOT_EVALUABLE` |
| `executed` | ✅ | 실제 집행 여부(boolean) |
| `outcome_basis` | ✅ | `ACTUAL`(실제 집행 결과, `executed=true` + 판단 `execution=EXECUTED` 필요) / `COUNTERFACTUAL`(가상 비교, `executed=false`). 집행된 판단에도 가상 비교 평가를 따로 남길 수 있음 |
| `execution_evidence` | `ACTUAL`이면 ✅ | `PRIVATE_REF:<불투명 ID>` 형식만 허용. 실제 체결 내용은 비공개 원장에만 두고 여기엔 참조 ID만 남김 |
| `market` | `T+N`이면 ✅ | `US` / `KRX` |
| `matured_session_date` | `T+N`이면 ✅ | N번째 정규장 날짜(해당 시장 현지 날짜). 주말이거나, 판단 이후 N번째 평일보다 이르면 실패 |
| `calendar_basis` | `T+N`이면 ✅ | 정확한 N번째 세션을 어떻게 확정했는지. `AUTO_NYSE_RULES`(US 전용: 검증기가 NYSE 규칙 휴장일로 직접 재계산해 일치 여부 확인) / `DECLARED_WITH_SOURCE`(작성자 **선언**: `calendar_evidence`에 출처·확인자·건너뛴 휴장일을 적고, 검증기가 그 휴장일로 재계산해 일치 확인) / `UNVERIFIED`(평일 하한만 확인, **잠정**) |
| `calendar_evidence` | `DECLARED_WITH_SOURCE`면 ✅ | `{source, checked_by, holidays_skipped:[날짜]}`. 규칙에 없는 임시 휴장은 `extra_closures:[날짜]` + `source`로 추가. **선언이 들어간 평가는 확정 점수에 들어가지 않음** |
| `event_evidence` | | 이벤트형 horizon(`next NO-POD` 등)의 발생 근거 `{source, occurred_at_kst}`. 발생 시각은 판단 이후·평가 이전이어야 함. 이벤트형 평가는 근거가 있어도 **항상 잠정** |
| `note` | ✅ | 평가 요약 |
| `observed` / `counterfactual` / `lesson` / `reviewer` | | 관측 수치 / 반대 선택 시 결과 / 개선점 / 평가자 |

## 평가 원칙

1. **판단 당시 얻을 수 있던 정보만으로** 의사결정의 질을 평가합니다. 결과론으로 채점하지 않습니다.
   - `T+N` = 판단 시각 이후, 판단 대상 시장(미국 지수 판단이면 미국, 국내 판단이면 KRX)의 **N번째 완료된 정규장 거래일 종가** 기준입니다. 휴장일은 세지 않습니다.
2. `ACTUAL`과 `COUNTERFACTUAL`은 **별도로 집계**하고 절대 합산하지 않습니다(`python tools/decision_ledger.py --scorecard`).
   - **확정(CONFIRMED)** = 검증기가 직접 다시 계산한 것만: US + `AUTO_NYSE_RULES` + 선언된 임시 휴장(`extra_closures`) 없음. NYSE 규칙 휴장일과 13:00 ET 조기 폐장(7/3·추수감사절 다음 날·12/24, 평일인 경우)을 반영합니다.
   - **잠정(PROVISIONAL)** = 그 외 전부: `DECLARED_WITH_SOURCE`(KRX 포함), 임시 휴장 선언, `UNVERIFIED`, 이벤트형 horizon.
   - 모든 시각·날짜는 형식뿐 아니라 실제 존재하는 값이어야 합니다(`2026-11-99`, `T99:00` 거부).
   - **어느 판단을 참조하나:** 형님이 승인·집행하면 원래 판단을 고치지 않고 `supersedes`로 연결된 새 판단(`owner_decision=APPROVED`, `execution=EXECUTED`, 같은 `review_at`)을 추가합니다. `ACTUAL` 평가는 이 **집행된 새 판단**을 참조하고, `COUNTERFACTUAL` 평가는 원래 판단을 참조합니다.
3. 판단을 바꿀 때는 기존 줄을 고치지 않고 `supersedes`가 붙은 새 줄을 추가합니다. CI가 base 대비 기존 줄의 수정·삭제·파일 삭제를 차단합니다.
4. 빈 원장은 PASS가 아닙니다. `daily-decisions.jsonl`이 하나도 없거나 판단이 0건이면 실패합니다.
5. 이 원장은 어떤 주문·배포·규칙 변경 권한도 부여하지 않습니다. 매매는 형님만 결정합니다.

## 검증

```bash
python tools/decision_ledger.py                      # 원장 전체 검증
python tools/decision_ledger.py --base origin/main   # + 기존 기록 수정·삭제 차단
python tools/decision_ledger.py --scorecard          # 실제/가상 × 확정/잠정 집계
python -m unittest tests/test_decision_ledger.py -v
```
