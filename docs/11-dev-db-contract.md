# 11. Dev DB Contract — SQLite-first Persistence Boundary

## Purpose

#44 fixes the dev-only persistence contract before #27/#31/#32/#33 implement route behavior.
The first pass uses Python `sqlite3` with `:memory:` by default and optional ignored `data/`
file persistence later. Supabase/Postgres is a future adapter behind the same repository
ports, not part of this implementation slice.

## Runtime boundary

- Frontend calls only FastAPI backend routes.
- Backend owns repository access and may call the Pi SDK agent service internally.
- Agent runtime never reads or writes the DB directly.
- Report/QA generated text remains strict Pi SDK-first; cached data may be read only after a
  real agent response has been saved.

## Schema version

`backend.storage.schema.SCHEMA_VERSION = "dev-db-v1"`

Every mutable table has `source_version` for seed/cache invalidation. Time fields are ISO-8601
UTC strings so future Supabase migration can map to `timestamptz` without changing API DTOs.

## Tables

| Table | Purpose | Required indexes / constraints |
|---|---|---|
| `users` | Dev users such as `admin/admin`; not production auth. | `username UNIQUE` |
| `watchlist_items` | User-scoped stock registrations. | `UNIQUE(user_id, corp_code)`, `idx_watchlist_user`, `idx_watchlist_corp` |
| `disclosures` | Normalized disclosure snapshots used by dashboard/report context. | primary `rcept_no`, `idx_disclosures_corp_date` |
| `analysis_reports` | Saved report detail/cache after real pipeline+agent generation. Stores structured checklist, Markdown narrative, request context, source timestamps, and `strict_pi_sdk` marker. | `idx_reports_user_corp_generated`, `idx_reports_generated` |
| `qa_history` | Saved Q&A turns after real Pi-agent answer generation. Stores corp scope, question, Markdown answer, evidence refs, and asked timestamp. | `idx_qa_user_corp_asked` |
| `agent_run_logs` | Observable pipeline/agent execution events. | `idx_agent_runs_user_started`, `idx_agent_runs_trace` |

## Repository ports

Repository interfaces live in `backend/storage/repositories.py` and hide SQLite details from
FastAPI routes:

- `UserRepository.get_by_username`, `upsert_dev_user`
- `WatchlistRepository.list_for_user`, `upsert_item`, `delete_item`
- `DisclosureRepository.list_recent`, `upsert_many`
- `ReportRepository.list_latest_for_user`, `get_latest_detail`, `save_detail`
- `QaHistoryRepository.list_for_user`, `save_answer`
- `AgentRunLogRepository.list_recent`, `save_run`

Routes should depend on a provider object rather than importing SQLite connection code directly.
This keeps the future Supabase adapter boundary at the repository-provider layer.

## Seed fixture contract

Tracked fixture: `backend/fixtures/dev_seed.json` (`version: dev-seed-v1`). It contains one `admin` user target, 3 watchlist rows, 5 disclosure rows, 3 report rows covering `normal`/`caution`/`high`, and 3 Q&A rows. The loader validates non-empty required collections, admin ownership, and checklist `pass`/`fail`/`unknown` coverage before inserting.

Saved report detail rows now include:
- `request_context_json` — the report request context used to generate the row
- `source_timestamps_json` — latest disclosure/news/price timestamps known at generation time
- `strict_pi_sdk` — `1` only when the row came from the strict backend→공시리 generation path

Saved Q&A rows now include:
- `corp_name` alongside `corp_code`
- `answer` as Markdown/user-facing text
- `evidence_json` preserving backend/공시리 evidence refs

## Runtime configuration

- `GONGSIRI_DB_MODE=memory` is the default and opens SQLite `:memory:`.
- `GONGSIRI_DB_MODE=file` uses `GONGSIRI_DB_PATH` or `data/dev.sqlite`.
- `connect_dev_db()` creates schema and seeds `admin/admin` plus `backend/fixtures/dev_seed.json` idempotently.
- `get_repository_provider()` is the backend app-level singleton used by routes/services.


## Dev auth session boundary

#28/#42 add a dev-only auth shell on top of the seeded `users` table:

- Backend route: `POST /api/v1/dev/auth/login`.
- Enablement gate: only `GONGSIRI_AUTH_MODE=dev` allows `admin/admin`; unset or any other value returns a typed disabled failure.
- Successful login returns a public dev session envelope plus a non-production token shaped as `dev-session:<user_id>`.
- The frontend stores that token in an HTTP-only `gongsiri_dev_session` cookie through its own `/api/auth/login` route and redirects protected app-shell pages to `/login` when the cookie is absent.
- Logout clears only the frontend dev cookie; no production JWT refresh/logout semantics exist in this slice.

The session token is a local demo routing marker, not a production secret. Routes that read or write user-scoped DB data should resolve the seeded admin user through backend repositories rather than trusting frontend state.

## Reset and seed lifecycle

- `create_schema(connection)` creates tables and indexes idempotently.
- `reset_schema(connection)` drops dev tables and recreates the contract.
- #43 owns seed fixture shape and idempotent loading through `backend/storage/fixture_loader.py`.
- #27 owns app startup wiring and `GONGSIRI_DB_MODE=memory` default behavior.
- `backend/main.py` initializes the provider on FastAPI startup.

## Out of scope

- Supabase integration first pass
- Production password hashing/JWT/session hardening
- Frontend direct DB access
- Agent direct DB access
- Fake report/QA success when Pi SDK agent fails
