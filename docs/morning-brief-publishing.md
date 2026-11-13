# 송팀장 아침 시황 게시 규격

**운영 자동화 기준 (2026-11-09 KST 실제 연결 설정 확인):** 기본 ChatGPT 자동화 `6ab723988af88191aed9e5c216ac69db`는 **매일 뉴욕 현지시간 16:25 ET** 예약(EDT 다음날 KST 05:25 / EST 다음날 KST 06:25)으로 활성화되어 있습니다. 이 시간은 실행 시작 예정 시각이지 보고서 생성·가격 독립검증·GitHub 게시 완료 보장 시각이 아닙니다. 별도 **월요일 05:40 KST** 자동화 `6abacf0979d48191819b1c19a8af7fc6`는 현재 **비활성화**되어 있으며 중복 발행을 일으키지 않습니다. 활성 기본 자동화의 요일별 내용·공개 게시 여부는 각 실행의 검증 결과에 따릅니다. `latest.json`은 현재 최신 **공개 게시 회차**만 나타내며 채팅 발송 완료와 별개입니다. 원천 수집/워치독 성공은 보고서 발행 성공을 의미하지 않습니다. 실행·자료/채팅·Git 커밋·Pages 전개를 각기 증거로 기록합니다.

## 경로

- 화면: https://mauveplace.github.io/jjooni-control-tower/market-observatory/#morning-brief
- 최신 원문: `market-observatory/data/morning-brief/latest.json`
- 날짜별 원문: `market-observatory/data/morning-brief/YYYYMMDD.json` (한국 작성일)
- 목록: `market-observatory/data/morning-brief/index.json`

## 본문 JSON

```json
{
  "schema": "JJOONI_MORNING_BRIEF_V1",
  "title": "송팀장 아침 시황 브리핑",
  "report_date_kst": "YYYY-MM-DD",
  "market_date_us": "YYYY-MM-DD",
  "generated_kst": "YYYY-MM-DDTHH:mm:ss+09:00",
  "published_kst": "YYYY-MM-DDTHH:mm:ss+09:00",
  "author": "송팀장 아침 시황 · ChatGPT",
  "content_status": "WEB_VERIFIED_WITH_DISCLOSED_GAPS",
  "verification_note": "해당 실행에서 확인한 출처·시각·미확인 항목은 본문 참조",
  "read_only": true,
  "contains_account_data": false,
  "body_markdown": "채팅에 출력할 완성된 동일 본문"
}
```

작성시각과 게시시각은 실제 시각을 사용한다. 보고서에 적힌 시간을 그대로 메타데이터에 반영하며, 미국장 기준일은 실제 확인된 완료 세션이다. 상단 메타와 본문의 기준일을 맞춘다. 미확인 수치는 임의 추정하지 않고 본문에 공개한다. 외부 링크는 실제 URL의 Markdown 링크로 저장하고 채팅 전용 citation 토큰은 게시 원문에 남기지 않는다. 본문 제목은 `## ①`부터 `## ⑧`까지 포함하고 표는 Markdown 표로 작성한다. 개인 계좌번호·잔고·비밀정보를 공개 저장소에 게시하지 않는다. 이 저장본은 해설 계층이며 시장 SSOT를 덮어쓰지 않는다.

오늘 최초 이관본의 `USER_PROVIDED_NOT_REVERIFIED`는 사용자 제공 원문이며 이번 게시에서 수치를 재검증하지 않았음을 뜻한다. 이후 웹 검증을 수행한 신규 실행에서만 `WEB_VERIFIED_WITH_DISCLOSED_GAPS`를 사용한다.

## 목록 JSON

```json
{
  "schema": "JJOONI_MORNING_BRIEF_INDEX_V1",
  "updated_kst": "YYYY-MM-DDTHH:mm:ss+09:00",
  "entries": [
    {
      "report_date_kst": "YYYY-MM-DD",
      "market_date_us": "YYYY-MM-DD",
      "title": "송팀장 아침 시황 브리핑",
      "generated_kst": "YYYY-MM-DDTHH:mm:ss+09:00",
      "published_kst": "YYYY-MM-DDTHH:mm:ss+09:00",
      "path": "YYYYMMDD.json"
    }
  ]
}
```

## 쓰기 순서 및 검증

1. 현재 main HEAD와 tree, 최신 원문 및 목록을 새로 읽는다. 같은 날짜는 교체, 다른 날짜는 보존하고 한국 작성일 내림차순으로 정렬한다.
2. 날짜별 원문과 latest는 동일 JSON이다. 기존 latest가 더 최신 작성일/작성시각이면 오래된 재실행은 날짜별 기록만 쓰고 latest를 이전 날짜로 되돌리지 않는다.
3. JSON 형식/작성일/미국장 기준일/8개 섹션/실제 원문 링크를 확인한다. `python tools/validate_morning_brief.py`는 최신 원문과 보관본·목록의 정합성을 검사한다.
4. GitHub 도구의 create_tree(base_tree_sha) → create_commit(parent_sha) → update_ref(main, expected_sha, force=false)를 사용해 날짜별 원문, latest, 목록을 한 커밋으로 게시한다. 다른 파일은 수정하지 않는다.
5. HEAD가 달라졌으면 다시 읽어 목록을 합친 뒤 재시도한다. 강제 push를 사용하지 않는다.
6. 반환 성공을 확인하고 해당 날짜별 원문을 다시 읽어 제목/작성일/미국장 기준일/본문이 일치하는지 확인한다. Pages 배포 완료를 확인한 경우에만 화면 반영 완료라고 보고한다. 진행 중이면 저장 완료/화면 배포 중으로 구분한다.

## 자동화와 시간

**등록 설정 확인일: 2026-11-09.** 활성화된 기본 브리핑의 예약은 **매일 16:25 America/New_York**로, 겨울 EST 기준 다음날 **06:25 KST**, 여름 EDT 기준 **05:25 KST**입니다. 공개 보고서의 06:30 KST 발행은 목표이며 확약이 아닙니다. 실제 완료 세션·독립 종가 검증·공개정보 필터를 통과하지 못하면 시황/개인정보를 지어내거나 빨리 발행하지 않습니다. 별도 월요일 05:40 KST PART A+B 자동화는 **현재 비활성화** 상태라 과거 일정 문구를 현행 운영이라고 취급하지 않습니다. 기본 자동화가 월요일에도 실행되는 현행 설정과 과거 월요일 전용 운영은 구분합니다. 최신 공개 JSON이 마지막 성공 보고서로 남는 것은 정상이나, 화면은 원문 세션일과 마지막 게시일을 명확히 표시해야 합니다. Pages UI는 최신 원문을 60초마다 다시 읽지만, 그 조회가 시황 재작성이나 원천 수집을 수행하지 않습니다. 비공개 `AI_BOARD`의 작성 여부는 실제 실행·접근 로그로만 인정합니다.


## 2026-11-03 일일시황 재구성 적용

[일일시황 구성·검증 계약](song-daily-editorial-contract.md)이 기존 섹션 순서보다 우선합니다. 오늘의 시장 이야기·숫자 대시보드·핵심 이슈의 인과 설명을 구성하고 완료 세션/DST/NDX·SOX 독립 가격 검증을 수행합니다. 같은 완성 본문을 채팅과 Observatory에 게시하며 PR·CI 통과만으로 반영 완료라고 하지 않습니다. 예약시간·개인정보·계좌 SSOT·주문 경계는 유지합니다.


## 2026-11-14 실제 운영 업데이트 — ROY×JJOONI 공통 템플릿

**활성 일일 자동화 실제 예약은 America/New_York 16:45 ET**입니다 (EST 다음날 KST 06:45, EDT 다음날 KST 05:45). 이보다 앞선 16:25/16:40/06:30 문장은 옛 운영 이력이지 현재 예약이 아닙니다. `market-observatory/data/morning-brief/YYYYMMDD.json` / latest / index는 여전히 한 세트로 PR 제출·CI 검사·승인된 병합·Pages 재조회를 완료해야 공개 반영입니다.

[템플릿 V2](morning-brief-roy-jjooni-template-v2-20261114.md)에 따라 2026-11-15 이후 새 보고서는 `canonical_source_vintage`, `market_metrics` 5대 지표, `dual_review` 상태가 필요합니다. 시황 보고서가 같은 세션 원장에 이미 존재하는 NDX/SOX/VIX10/MA250/DD를 `MISSING`으로 기록하면 CI가 실패합니다. 단일 Yahoo 제공자의 참고값은 수치로 공개해도 `OFFICIAL_VERIFIED`가 아니며 거래신호로 사용하지 않습니다. ROY의 실제 별도 의견/원본 댓글을 확인하지 못하면 `PENDING`이지 공동 검증 PASS가 아닙니다. 사후 정정은 원 발행 시각과 이전 revision 원문 이력을 보존하며, 원문-정정 시점을 분리합니다.
