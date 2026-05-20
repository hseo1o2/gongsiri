# 02. Folder Structure — Pi Bootstrap PR1

## Purpose
Phase-1 Pi bootstrap에서 어떤 폴더가 무엇의 source of truth인지 고정한다.

## Canonical Runtime Root
- Canonical Pi runtime root: `agent/`
- PR1에서는 `agent/`가 orchestration, skill selection, tool wiring, contract ownership의 중심이다.
- `backend/main.py`는 기존 FastAPI surface이며 PR1에서 Pi host 역할을 하지 않는다.

## Ownership Map
| Path | Owner | Responsibility |
| --- | --- | --- |
| `agent/` | Pi runtime | session wiring, agent, skill, tool wrappers, runtime contracts |
| `backend/collector/` | Python collector | corp code resolution, DART fetch, market/news/document ingestion |
| `backend/analyzer/` | Python analyzer | follow-up phase risk scoring/report generation |
| `backend/schemas/` | Python domain schema | normalized bundle and collector-facing payload truth |
| `docs/` | Repo-local SoT | milestone authority for structure, contracts, env, feature scope |
| `assets/` | tracked assets | read-only runtime reference data in PR1 (`stock_master.json` must not mutate) |
| `frontend/` | out of scope for PR1 | reserved for future UI work |

## Current PR1-Relevant Backend Files
- `backend/collector/company_resolver.py` — read-only company resolution
- `backend/collector/bridge/disclosures.py` — typed disclosure bridge envelope
- `backend/collector/cli/fetch_disclosures.py` — canonical subprocess entrypoint
- `backend/collector/dart.py` — authoritative disclosure fetch implementation
- `backend/collector/krx/search.py` — existing stock lookup and persistent search path

## Placement Rules
1. New Pi runtime code belongs under `agent/`, not `backend/agent/`.
2. Existing collector/analyzer code remains authoritative for domain execution.
3. Bridge entrypoints that Pi calls live in Python under `backend/collector/cli/`.
4. Cross-runtime contracts must be documented in `docs/03` and `docs/07` before they drift in code.

## PR1 Non-Goals
- no frontend UI structure changes
- no cron / scheduler folder design
- no DB persistence layout
