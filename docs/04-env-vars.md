# 04. Environment Variables — Pi Bootstrap PR1

## Purpose

PR1에서 Pi runtime과 Python collector bridge가 기대하는 환경변수를 명확히 기록한다.

## Required Variables

### Pi runtime / Node side

- `UPSTAGE_API_KEY` — Upstage Solar runtime access key
- `UPSTAGE_MODEL` — optional model override (e.g. `solar-pro3`)
- `UPSTAGE_BASE_URL` — optional OpenAI-compatible Upstage base URL; default `https://api.upstage.ai/v1`
- `PYTHON_BIN` — optional Python executable override for bridge spawning
- `GONGSIRI_CONTRACT_VERSION` — optional contract version override; default policy is `v1`
- `GONGSIRI_CHECKPOINT_PATH` — optional local checkpoint file override for last-seen disclosure state
- `GONGSIRI_SCHEDULER_INTERVAL_MINUTES` — optional default interval for cron/scheduler checks (default `30`)
- `GONGSIRI_AGENT_HOST` — optional Pi SDK HTTP service bind host; default `127.0.0.1`
- `GONGSIRI_AGENT_PORT` — optional Pi SDK HTTP service bind port; default `8787`
- `GONGSIRI_AGENT_URL` — backend-to-agent internal HTTP base URL; default `http://127.0.0.1:8787`
- `GONGSIRI_DB_MODE` — dev DB mode for local persistence; `memory` default, optional `file` for ignored `data/` persistence
- `GONGSIRI_DB_PATH` — optional SQLite file path when `GONGSIRI_DB_MODE=file`; default `data/dev.sqlite`
- `GONGSIRI_AUTH_MODE` — optional dev auth gate; only exact `dev` enables `admin/admin` demo login. If unset, dev auth is disabled.
- `GONGSIRI_CRON_ENABLED` — optional cron scheduler enable flag; default `true` (set to `"false"` to disable in CI/test environments)
- `AGENT_BACKEND_URL` — optional backend base URL for cron-originated report push; default `http://127.0.0.1:8000`
- `NEXT_PUBLIC_API_BASE_URL` — optional frontend/runtime HTTP base URL for typed API clients (default `http://localhost:8000`)
- `GONGSIRI_SKIP_SEED` — optional; set to `"1"` to skip automatic report seeding on backend startup (cold-start 단축, 개발/CI 용도)

### Python collector side

- `DART_API_KEY` — OpenDART disclosure API key
- `KRX_API_KEY` — KRX 공공데이터포털 service key for price/volume collection (자체 KRX 클라이언트용)
- `NAVER_CLIENT_ID` — Naver news search API client id
- `NAVER_CLIENT_SECRET` — Naver news search API client secret

## QA Warm Session 튜닝 상수

QA Warm Session 튜닝값은 코드 상수 (`IDLE_TTL_MS=30분, MAX_WARM=100`) — 환경변수로 노출하지 않는다.

## Default Policy

- `PYTHON_BIN` is optional; if omitted, the runtime may use `python3` as the default executable policy.
- `GONGSIRI_CONTRACT_VERSION` may remain unset when code defaults to `v1`.
- Missing `DART_API_KEY` must produce a typed `missing_env` failure in the bridge response path.

## `.env.example` Policy

Root `.env.example` must document the PR1 bootstrap keys as:

```dotenv
UPSTAGE_API_KEY=
UPSTAGE_MODEL=solar-pro3
UPSTAGE_BASE_URL=https://api.upstage.ai/v1
PYTHON_BIN=python3
GONGSIRI_CONTRACT_VERSION=v1
DART_API_KEY=
KRX_API_KEY=
NAVER_CLIENT_ID=
NAVER_CLIENT_SECRET=
GONGSIRI_CHECKPOINT_PATH=
GONGSIRI_SCHEDULER_INTERVAL_MINUTES=30
GONGSIRI_AGENT_HOST=127.0.0.1
GONGSIRI_AGENT_PORT=8787
GONGSIRI_AGENT_URL=http://127.0.0.1:8787
GONGSIRI_DB_MODE=memory
GONGSIRI_DB_PATH=data/dev.sqlite
GONGSIRI_AUTH_MODE=dev
NEXT_PUBLIC_API_BASE_URL=http://localhost:8000
```

`agent/.env.example` may mirror the Pi-only subset, but the repo-root `.env.example` is the onboarding source of truth for PR1.

## Runtime Separation

- Pi runtime env controls orchestration and subprocess invocation.
- Upstage Solar chat/runtime verification paths consume `UPSTAGE_API_KEY` and optionally `UPSTAGE_MODEL`.
- Demo report/QA paths are strict Pi SDK-first: if `UPSTAGE_API_KEY` is missing or the Pi SDK HTTP service is down, the backend returns a typed failure instead of using a Solar-only fallback.
- User-facing report/QA/notification copy must speak in first person as `공시리` (for example, `저 공시리가...`).
- Dev DB env controls local SQLite only; it must not imply Supabase or production auth behavior.
- Dev auth is explicit opt-in: `GONGSIRI_AUTH_MODE=dev` enables only the seeded `admin/admin` demo session; no JWT/Supabase/production credential path is implied.
- Python env controls disclosure fetch execution.
- Naver news adapter requires `NAVER_CLIENT_ID` + `NAVER_CLIENT_SECRET`; missing values must produce a typed adapter failure rather than silent empty results.
- stderr may contain diagnostics, but business output for the bridge must be machine-readable JSON on stdout only.

## Local Loading Policy

- `agent/` runtime surfaces may auto-load ignored local env files from repo-root `.env` and `agent/.env`.
- Explicit shell environment variables still win over env-file defaults.
- Optional override for deterministic tooling/tests: `GONGSIRI_ENV_FILE=<path-to-env>`.
- Frontend typed API helpers append `/api/v1` beneath `NEXT_PUBLIC_API_BASE_URL`; callers should pass the service origin, not a pre-suffixed reports path.

## Deployment Mapping

### Vercel frontend

- Project root: `frontend/`
- Required env:
  - `NEXT_PUBLIC_API_BASE_URL` — Railway backend public URL, for example `https://gongsiri-backend.up.railway.app`

### Railway backend

- Service config: `backend/railway.toml`
- Dockerfile: `backend/Dockerfile`
- Required env:
  - `UPSTAGE_API_KEY`
  - `DART_API_KEY`
  - `GONGSIRI_AGENT_URL` — Railway agent public URL, for example `https://gongsiri-agent.up.railway.app`
- Optional env:
  - `UPSTAGE_MODEL`
  - `UPSTAGE_BASE_URL`
  - `KRX_API_KEY`
  - `NAVER_CLIENT_ID`
  - `NAVER_CLIENT_SECRET`
  - `GONGSIRI_DB_MODE`
  - `GONGSIRI_DB_PATH`
  - `GONGSIRI_AUTH_MODE`

### Railway agent

- Service config: `agent/railway.toml`
- Dockerfile: `agent/Dockerfile`
- Required env:
  - `UPSTAGE_API_KEY`
- Optional env:
  - `UPSTAGE_MODEL`
  - `UPSTAGE_BASE_URL`
  - `DART_API_KEY`
  - `GONGSIRI_CONTRACT_VERSION`
  - `GONGSIRI_SCHEDULER_INTERVAL_MINUTES`
  - `GONGSIRI_CHECKPOINT_PATH`
  - `GONGSIRI_CRON_ENABLED` — set to `"false"` in CI; default `true` in production
  - `AGENT_BACKEND_URL` — backend service URL for cron-originated `POST /api/v1/reports`

Railway provides `PORT`; the agent maps that automatically when `GONGSIRI_AGENT_PORT` is unset.
