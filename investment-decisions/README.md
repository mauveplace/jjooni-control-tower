# Investment Decision Ledger (공개 판단 원장)

JJOONI·ROY의 투자 판단을 **기록 → 사후 검증 → 개선**으로 연결하는 정형 원장입니다.
토론은 GitHub Issue, 정형 기록은 이 폴더의 JSONL, 규칙·코드 변경은 PR로 분리합니다.

> 이 저장소는 **공개**입니다. 계좌 잔액, 보유 종목·수량, 평단, 손익, 주문·체결 내역은 절대 기록하지 않습니다.
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
| `review_at` | ✅ | 사후 평가 시점 목록(중복 금지). `T+1`, `T+5`, `T+20` 또는 `next NO-POD` 같은 이벤트 |
| `inputs` | | 판단 당시 공개 시장 수치 (지수, VIX, 이동평균 등) |
| `inputs_meta` | `inputs`가 있으면 ✅ | `source`(출처), `observed_at_kst`(관측 시각), `verification`(`INDEPENDENTLY_VERIFIED` / `SINGLE_SOURCE` / `UNVERIFIED`) |
| `jjooni` / `roy` | | 각자의 의견 |
| `dissent` | | 남은 이견 |
| `rationale` | | 근거 요약 |
| `supersedes` | | 이전 판단을 바꿀 때 대상 `decision_id`. **기존 줄은 수정하지 않고 새 줄을 추가** |
| `sources` / `source_issue` | | 출처 URL 목록 / 토론 Issue 번호 |

## outcome-reviews.jsonl 필드

| 필드 | 필수 | 설명 |
|---|---|---|
| `decision_id` | ✅ | 평가 대상 판단 (원장에 존재해야 함) |
| `horizon` | ✅ | 해당 판단의 `review_at`에 있는 값만 허용. 같은 판단·같은 시점의 평가는 1건만 |
| `asof_kst` | ✅ | 평가 시각. 판단 시각 이후여야 함 |
| `verdict` | ✅ | `CORRECT` / `INCORRECT` / `MIXED` / `NOT_EVALUABLE` |
| `executed` | ✅ | 실제 집행 여부(boolean). **가상 판단과 실현 결과를 섞지 않기 위한 필드** |
| `note` | ✅ | 평가 요약 |
| `observed` / `counterfactual` / `lesson` / `reviewer` | | 관측 수치 / 반대 선택 시 결과 / 개선점 / 평가자 |

## 평가 원칙

1. **판단 당시 얻을 수 있던 정보만으로** 의사결정의 질을 평가합니다. 결과론으로 채점하지 않습니다.
   - `T+N` = 판단 시각 이후, 판단 대상 시장(미국 지수 판단이면 미국, 국내 판단이면 KRX)의 **N번째 완료된 정규장 거래일 종가** 기준입니다. 휴장일은 세지 않습니다.
2. 실행하지 않은 판단(`executed=false`)은 방향성만 평가하고, 실현 수익과 합산하지 않습니다.
3. 판단을 바꿀 때는 기존 줄을 고치지 않고 `supersedes`가 붙은 새 줄을 추가합니다. CI가 base 대비 기존 줄의 수정·삭제·파일 삭제를 차단합니다.
4. 빈 원장은 PASS가 아닙니다. `daily-decisions.jsonl`이 하나도 없거나 판단이 0건이면 실패합니다.
5. 이 원장은 어떤 주문·배포·규칙 변경 권한도 부여하지 않습니다. 매매는 형님만 결정합니다.

## 검증

```bash
python tools/decision_ledger.py                      # 원장 전체 검증
python tools/decision_ledger.py --base origin/main   # + 기존 기록 수정·삭제 차단
python -m unittest tests/test_decision_ledger.py -v
```
