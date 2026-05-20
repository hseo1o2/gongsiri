# 05. Feature Spec — Pi Agent Bootstrap PR1

## Goal
Make Pi SDK the heart of Gongsiri for one manual disclosure-intake path.

## In Scope
- top-level `agent/` runtime bootstrap
- Upstage Solar session wiring
- `PiDisclosureAgent`
- `disclosure-intake-skill`
- `fetch_disclosures` runtime tool
- Python subprocess bridge at `backend/collector/cli/fetch_disclosures.py`
- read-only company resolution for `keyword -> corpCode`
- deterministic tests
- repo-local SoT docs under `docs/`

## Out of Scope
- frontend UI
- cron / APScheduler
- notifications
- DB persistence
- analyzer/report orchestration beyond first disclosure tool path
- HTTP-hosted Pi runtime

## Happy Path
1. Operator runs Pi runtime from `agent/`.
2. User prompt asks for disclosure retrieval.
3. `PiDisclosureAgent` chooses `disclosure-intake-skill`.
4. Skill calls `fetch_disclosures`.
5. Tool resolves `corpCode` directly or via read-only keyword resolution.
6. Python bridge runs canonical disclosure fetch.
7. Pi returns a typed response with evidence.

## Acceptance Criteria
1. `agent/` is the canonical runtime root.
2. One manual prompt path works locally.
3. `fetch_disclosures` supports both `corpCode` and `keyword` input.
4. `corpCode` direct path bypasses resolution.
5. unresolved corp code produces typed failure.
6. bridge stdout is JSON-only and deterministic.
7. failure modes remain machine-readable.
8. runtime path does not mutate tracked assets.
9. repo-local docs `02` through `07` exist and match the approved plan.

## PR1 Evidence Expectations
- TS typecheck command
- TS tests for runtime/contract routing
- Python tests for bridge/resolution behavior
- one local manual smoke run
- proof of no `assets/stock_master.json` mutation
