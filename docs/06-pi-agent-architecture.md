# 06. Pi Agent Architecture — PR1

## Architecture Summary
PR1 uses a thin Pi → Python subprocess architecture. Pi owns orchestration; Python owns disclosure-domain execution.

## Component View
### Pi runtime layer
Planned home: `agent/`

Responsibilities:
- session lifecycle
- prompt intake
- skill selection
- tool invocation
- runtime request/response envelopes

### Python bridge layer
Current files:
- `backend/collector/bridge/disclosures.py`
- `backend/collector/cli/fetch_disclosures.py`
- `backend/collector/company_resolver.py`

Responsibilities:
- validate request shape
- resolve corp code in read-only mode when needed
- call authoritative DART collector
- map exceptions to typed bridge failures
- emit JSON envelope on stdout

### Domain execution layer
Current files:
- `backend/collector/dart.py`
- `backend/collector/krx/search.py`
- other `backend/collector/*` modules

Responsibilities:
- collect disclosure/news/market/doc data
- maintain domain-specific logic
- remain the source of truth for disclosure fetch behavior

## Sequence
1. Pi receives prompt.
2. Agent chooses `disclosure-intake-skill`.
3. Skill invokes `fetch_disclosures`.
4. Tool spawns `python -m backend.collector.cli.fetch_disclosures`.
5. Bridge resolves corp code if required.
6. Bridge calls `backend.collector.dart.fetch_disclosures`.
7. Bridge returns typed success/failure envelope.
8. Pi packages the result into an `AgentResponse`.

## Constraints
- no HTTP delegation in PR1
- no tracked asset mutation during runtime fetch
- `backend/main.py` remains passive and separate from Pi hosting
- observability requires `traceId`, `contractVersion`, `observedAt`, and evidence propagation

## G002 Trigger Architecture Addendum

### New runtime components
- `agent/src/triggers/` — typed trigger normalization and checkpoint-aware execution
- `agent/src/state/` — ignored local checkpoint store for last-seen disclosure IDs
- `agent/src/scheduler/` — cron-oriented orchestration surface that delegates to the same trigger runtime
- `agent/src/cli/` — one-off/manual trigger entrypoint

### G002 rules
- checkpoint identity is canonicalized to resolved `corpCode`
- failed runs do not advance checkpoint state
- cron/manual/system triggers all reuse the same Python bridge path
- G002 remains runtime-only and does not add frontend, DB, or notification components

## G003 Pipeline Architecture Addendum

### New Python components
- `backend/collector/runtime_normalize.py` — Pi-safe read-only/additive normalization adapter
- `backend/analyzer/` — deterministic checklist/report orchestration
- `backend/analyzer/cli/run_pipeline.py` — canonical Python pipeline entrypoint

### New runtime components
- `agent/src/contracts/pipeline.ts` — pipeline request/result contracts
- `agent/src/tools/runAnalysisPipeline.ts` — TS wrapper for the Python pipeline command
- `agent/src/cli/runPipelineTrigger.ts` — one-off pipeline trigger entrypoint

### G003 rules
- runtime pipeline requests must support both `keyword` and `corpCode`
- pipeline normalization must not persist new symbols to `assets/stock_master.json`
- pipeline normalization must not delete local report files
- analyzer core should stay deterministic first, with any narrative/LLM boundary clearly isolated
- persistence/notification stay as DTO/port preparation only
