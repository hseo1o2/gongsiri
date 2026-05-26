# storage-sqlite-unification

**category**: decision  
**confidence**: high  
**date**: 2026-05-26  
**branch**: verdict/storage-sqlite-unification

## Context

Split-brain 발견: 워치리스트·공시 체크포인트·리포트 캐시가 `data/*.json` 파일로 관리되고, SQLite in-memory SoT(`/api/v1/dev/*`)와 동기화되지 않았다. 사용자가 `/watchlist` 페이지에서 종목을 추가하면 `data/watchlist.json`에만 반영되고 대시보드/QA SQLite에는 나타나지 않는 증상이 발생했다.

분리된 두 store:

1. `data/watchlist.json` — `backend/routes/watchlist_routes.py` (`/api/watchlist`)
2. `data/disclosure_checkpoints.json` — `backend/routes/disclosure_check_routes.py`
3. `data/reports/{corp_code}.json` — `backend/routes/report_cache_routes.py`
4. SQLite in-memory — `backend/storage/` (issue-48 도입, `/api/v1/dev/*`)

## Decision

**Storage SoT = SQLite file mode (`data/dev.sqlite`)**

- `connect_dev_db()` 기본 mode를 `FILE_MODE`로 변경 (`GONGSIRI_DB_MODE` 환경변수 override 계속 지원)
- `data/*.json` 별도 store 신규 도입 금지
- 테스트는 `GONGSIRI_DB_MODE=memory`를 명시하여 격리

## Changes

| 파일                                        | 변경 내용                                                                                                                       |
| ------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| `backend/storage/connection.py`             | 기본 mode `FILE_MODE`로 변경                                                                                                    |
| `backend/storage/schema.py`                 | `disclosure_checkpoints`, `report_cache` 테이블 추가, `watchlist_items.last_checked` 컬럼 추가, SCHEMA_VERSION `dev-db-v2` 갱신 |
| `backend/storage/sqlite_identity.py`        | `SQLiteDisclosureCheckpointRepository`, `SQLiteWatchlistRepository.update_last_checked` 추가                                    |
| `backend/storage/sqlite_cache.py`           | `SQLiteReportCacheRepository` 신규                                                                                              |
| `backend/storage/sqlite_repositories.py`    | `disclosure_checkpoints`, `report_cache` provider 필드 추가                                                                     |
| `backend/routes/watchlist_routes.py`        | **삭제** — `/api/watchlist` JSON 라우터 제거                                                                                    |
| `backend/routes/disclosure_check_routes.py` | JSON store → SQLite 리팩터                                                                                                      |
| `backend/routes/report_cache_routes.py`     | JSON store → SQLite 리팩터                                                                                                      |
| `backend/services/report_seed.py`           | JSON store → SQLite 리팩터                                                                                                      |
| `backend/main.py`                           | `watchlist_router` 등록 제거                                                                                                    |
| `frontend/app/api/watchlist/route.ts`       | 백엔드 `/api/v1/dev/watchlist`로 fan-out, shape 정합, auth guard 추가                                                           |
| `AGENTS.md`                                 | storage SoT 문구 갱신                                                                                                           |
| `backend/tests/test_dev_db_store.py`        | file mode default 반영, 테스트용 tmp_path 사용                                                                                  |
| `backend/tests/test_dev_data_routes.py`     | `GONGSIRI_DB_MODE=memory` 명시로 테스트 격리                                                                                    |

## Rationale

- 관계형 모델이 JSON 파일보다 적합 (user_id 스코프, 외래키, 복합 PK)
- 기존 fixture 메커니즘(`backend/fixtures/dev_seed.json`) 재사용 가능
- Supabase(Postgres) 이행 시 schema/repository 패턴을 그대로 옮길 수 있음
- 테스트 격리: in-memory mode는 테스트에만 사용, 런타임은 file mode

## Consequences

- `data/*.json` 신규 도입 금지 — schema migration으로 테이블 추가
- `GONGSIRI_DB_MODE=memory`는 테스트 전용
- SQLite file mode는 단일 프로세스 write를 가정 (Railway 단일 인스턴스에서 OK)
- 기존 `data/*.json`이 남아 있어도 무시됨 (gitignore)

## Follow-ups

- collector/analyzer의 임시 JSON 저장도 동일 패턴으로 점진 통합
- Supabase 이행 시 `SQLiteRepositoryProvider` → `PostgresRepositoryProvider` 교체

## Links

- [gongsiri.md](gongsiri.md)
- [gongsiri-http-pi-sdk.md](gongsiri-http-pi-sdk.md)
- [verdict-watchlist-mvp-integration.md](verdict-watchlist-mvp-integration.md)
