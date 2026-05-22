# 13. End-to-End State Matrix — Auth → Dashboard → Watchlist → Report Detail → Q&A

## Purpose

G011 (#41)은 데모 사용자가 `admin/admin` 로그인부터 dashboard, watchlist, report detail, Q&A까지 이어지는 흐름에서 어떤 상태를 만나도 길을 잃지 않도록 state coverage를 명시한다.

범위는 **state coverage**다. full redesign은 하지 않는다.

## Happy path smoke

1. `/login` 에서 `admin/admin` 로그인
2. `/dashboard` 진입 후 watchlist/disclosure ready 상태 확인
3. `/watchlist` 에서 종목 추가/삭제 상태 확인
4. `/report` 에서 saved summary 목록 진입
5. `/report/[corpCode]` 에서 saved/generated detail 및 재분석 흐름 확인
6. `/qa` 에서 현재 답변 + 최근 저장 이력 확인

## State matrix

| Route | Required states | Current demo coverage | Smoke note |
| --- | --- | --- | --- |
| `/login` | dev-shell, loading, error | 로그인 shell + loading 버튼 + 오류 배너 | `admin/admin` 또는 실패 메시지 확인 |
| `/dashboard` | auth-required, loading, error, empty, saved, stale | 세션 게이트 + watchlist/disclosure loading/error/ready + stale cache 설명 | 로그인 없이 접근 시 `/login`, 로그인 후 ready 상태 확인 |
| `/watchlist` | loading, error, empty, saved | 로딩/오류/빈 목록/저장 목록 | 추가/삭제 후 상태 전이 확인 |
| `/report` | empty, error, saved, stale | 저장 리포트 없을 때 empty, 불러오기 실패 시 error, 저장 후 summary list, stale cache 설명 | detail 진입 전 summary 확인 |
| `/report/[corpCode]` | error, generated, saved, stale | 상세 불러오기 실패, cache miss generated, cache hit saved, stale cache 설명 | 재분석 후 refresh 동작 포함 |
| `/qa` | loading, empty, error, saved, stale | 현재 답변 로딩, 이력 empty/error/saved, stale saved history 설명 | 현재 답변 + 최근 이력 함께 확인 |

## Copy rule

- agent/backend failure copy는 1인칭 `공시리` 톤을 유지한다.
- 예: `저 공시리가 답변을 가져오지 못했습니다.`
- 내부 구현명(`Pi agent`, `agent service`)은 사용자 문구에 노출하지 않는다.

## Source of truth links

- code matrix: `frontend/lib/journeyStateMatrix.ts`
- matrix tests: `frontend/test/journeyStateCoverage.test.tsx`
- auth shell: `frontend/app/(auth)`
- dashboard/watchlist/report/qa screens: `frontend/app/(app)`

## Stale definition

- `stale`는 저장/캐시 데이터가 최신 재분석 이전 상태일 수 있음을 사용자에게 설명하는 상태다.
- current slice에서는 stale semantics를 설명 배너/문구 수준으로 정의한다.
- 전용 stale badge/component 추가는 out-of-scope다.
