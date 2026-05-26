---
title: "워치리스트 MVP 통합 verdict 결과 (PR1+PR2+PR3+PR4)"
tags:
  [
    "gongsiri",
    "verdict",
    "integration",
    "watchlist",
    "disclosure",
    "quote",
    "report",
    "decision",
  ]
created: 2026-05-26T08:05:00.000Z
updated: 2026-05-26T08:05:00.000Z
sources: []
links: ["gongsiri-http-pi-sdk.md", "gongsiri-8.md", "gongsiri.md"]
category: decision
confidence: high
schemaVersion: 1
---

# 워치리스트 MVP 통합 verdict 결과

**브랜치:** `verdict/watchlist-mvp-integration` (PR1+PR2+PR3+PR4 stacked merges)
**일자:** 2026-05-26
**검증 시나리오:** SK하이닉스 검색 → 워치리스트 추가 → 주가 갱신 → 지금 체크 → /report/000660
**결과:** 6/6 PASS (visual-verdict via Playwright MCP)

## 통합 도중 발견·패치한 결함 4건

### 1. 라우트 등록 순서 shadowing

- **증상**: `/api/stocks/search` 호출 시 PR1의 `stocks_routes`가 아니라 PR2 이전부터 있던 `external_api_routes` (K-Skill 프록시)가 먼저 매칭 → corp_code가 항상 `null`.
- **원인**: FastAPI는 등록 순서대로 first-match. `external_api_router`가 `stocks_router`보다 먼저 등록돼 있었음.
- **패치**: `backend/main.py`에서 `stocks_router`를 `external_api_router`보다 위로 이동.

### 2. 검색이 3종목으로 제한

- **증상**: 라우트 순서 스왑 후 SK하이닉스 검색 결과 0건. `stocks_routes`가 `find_in_local_master()`만 호출했고, `assets/stock_master.json`엔 카카오/삼성전자/NAVER 3건뿐.
- **결정**: "자동으로 검색해서 저장" — 모든 상장사 검색 가능해야 함.
- **패치**:
  - 신규 `backend/collector/dart_corp_index.py` — OpenDART `corpCode.xml` ZIP 다운로드 → `stock_code → corp_code` 인덱스 빌드 → `data/dart_corp_index.json` 캐시 (1일 TTL, thread-safe). 3,967 종목 매핑.
  - `backend/collector/krx/search.py` — `resolve_companies(q)` 추가: (1) 로컬 마스터 → (2) K-Skill 멀티 검색 (5s 타임아웃) → (3) DART corp_code enrichment. corp_code 없는 결과는 필터링.
  - `backend/routes/stocks_routes.py` — `find_in_local_master` 단일 호출 → `resolve_companies` 사용.

### 3. CORS 차단 (watchlist 페이지 빈 화면)

- **증상**: data/watchlist.json에는 SK하이닉스가 저장됐는데 워치리스트 페이지가 빈 상태.
- **원인**: `frontend/app/(app)/watchlist/page.tsx`가 `${apiBase}/api/watchlist` 절대 URL로 요청 → cross-origin (127.0.0.1:3000 ↔ localhost:8000), Next.js 프록시 우회.
- **패치**: 상대 URL `/api/watchlist`로 변경. `frontend/app/api/watchlist/route.ts` 프록시가 동일 origin에서 백엔드로 forward.

### 4. Next.js 16 sync-params 트랩

- **증상**: 주가 갱신 → 응답 `stock_code: "undefined"`.
- **원인**: `frontend/app/api/quote/[stockCode]/route.ts`가 `params.stockCode` 동기 접근. Next.js 16.2.6 dynamic route는 `params`가 Promise.
- **패치**: 시그니처 `{ params }: { params: Promise<{ stockCode: string }> }` + `const { stockCode } = await params`.
- **선체크**: 같은 트랩이 `frontend/app/(app)/report/[corpCode]/page.tsx`에도 있는지 검사 → 이미 Promise 처리됨 (PR3에서 올바르게 작성).

## PR2 미스매치 정렬 — disclosure-check는 backend가 DART 직접 호출

`backend/routes/disclosure_check_routes.py`가 agent의 `POST /disclosure-trigger`를 호출하던 코드였는데, agent HTTP 노출 경로는 `/health, /report, /qa, /checklist-explanation` 뿐 (`agent/src/agentHttpRuntime.ts`).

**해법 결정 근거** ([[gongsiri 에이전트 HTTP + Pi SDK 전환 결정]] §결정 #5, §통신 규칙):

- "백엔드가 DART 수집 + 6항목 정량 채점, 에이전트는 Solar 추론만"
- "agent → backend 금지, agent는 leaf"
- 자율 disclosureScheduler 루프는 [[gongsiri §8 자율 동작 갭]]에서 보류

→ agent 수정 금지. backend가 `fetch_disclosures` (OpenDART list.xml) 직접 호출하고 `data/disclosure_checkpoints.json` (corp_code → 마지막 본 rcept_no) 으로 신규 공시 판정.

**첫 호출 false-positive 방지**: 체크포인트 없으면 `hasNewDisclosure=false`로 두고 현재 최신만 저장.

## 검증 결과 (6 step PASS)

| Step | 항목                                         | 결과 | 근거                                                                                 |
| ---- | -------------------------------------------- | ---- | ------------------------------------------------------------------------------------ |
| 1    | 부팅 + 워치리스트 진입                       | PASS | `/api/watchlist` 200                                                                 |
| 2    | SK하이닉스 동적 검색 + corp_code 매핑 + 저장 | PASS | `data/watchlist.json`에 `corp_code: "00164779"`                                      |
| 3    | row 렌더                                     | PASS | CORS 우회 후 row 표시                                                                |
| 4    | 주가 갱신                                    | PASS | 1,941,000 / ▲0.05%                                                                   |
| 5    | 지금 체크 (공시 조회)                        | PASS | `신규 공시 없음` alert, `disclosure_checkpoints.json` 생성 (00164779→20260515002407) |
| 6    | /report/000660 캐시 미스 UI                  | PASS | "분석 중..." + [지금 재분석] 버튼                                                    |

## 후속 (verdict 범위 밖, 별도 작업)

- PriceCell 2개 분리 렌더 (현재가/등락) → 셀당 단일 데이터로 단순화 검토
- lifespan에서 DART corp_code 인덱스 워밍업 (첫 검색 1-2s 지연 제거)
- `external_api_routes.py /api/stocks/search`는 shadowing으로 dead code — 의도 확인 후 제거 검토
- agent 측 disclosure HTTP 엔드포인트 추가는 [[gongsiri §8 자율 동작 갭]] 따라 별도 PR

## 관련 위키

- [[gongsiri 에이전트 HTTP + Pi SDK 전환 결정]] — backend/agent 책임 분담
- [[gongsiri §8 자율 동작 갭]] — 자율 disclosure scheduler 보류 결정
- [[gongsiri 에이전트 아키텍처]] — 전체 R&R
