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
- ~~no HTTP delegation in PR1~~ — **superseded by the HTTP + Pi SDK Architecture Decision below (2026-05-21)**
- no tracked asset mutation during runtime fetch
- ~~`backend/main.py` remains passive and separate from Pi hosting~~ — **superseded**: backend now actively orchestrates the agent from its service layer
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

## Solar Chat Verification Addendum

### Runtime surface
- `agent/src/tools/chatWithSolar.ts`
- `agent/src/cli/runSolarChat.ts`

### Role
- provide one live Upstage Solar-backed Pi runtime communication path for operator/runtime verification
- keep API-key use in env only
- return a typed machine-readable chat envelope

## HTTP + Pi SDK Architecture Decision (2026-05-21)

This decision supersedes the PR1 "no HTTP delegation" / "passive backend" constraints
above. It defines the target architecture for connecting the **report** and **QA**
paths to the agent. Status: **implemented for demo, still requires team review before merge**
(CLAUDE.md rule 6 — this changes the A↔B↔C seam).

### Decision summary

1. **Layered backend, single frontend surface.** The frontend talks only to the
   backend (FastAPI). The frontend never knows the agent exists.
2. **Agent runtime = separate long-running Node HTTP service** that uses the real
   Pi SDK (`@earendil-works/pi-coding-agent`). The existing `agent/` package is
   now the demo runtime (`npm run serve`) instead of a Pi-named skeleton.
3. **The backend service layer calls the agent over internal HTTP.** The agent sits
   *below* the controller, invoked by the service/application layer — not in front of
   the backend.
4. **The agent is a leaf.** It must never call backend HTTP endpoints and never touch
   the production DB. It returns drafts/explanations only. This removes the
   `backend → agent → POST /pipeline/trigger → backend` cycle.
5. **Option A division of labour.** The backend collects DART data and runs the
   deterministic 6-item scoring (`backend/collector/` + `backend/analyzer/`), then
   hands a normalized bundle to the agent. The agent performs Solar reasoning and
   produces the report narrative / QA answer. No re-port of the Python analyzer.

### Target call flow

```
Frontend ──HTTP──> Backend (FastAPI)
                     controller : backend/api/
                       └ application/service layer
                           1. collector + analyzer  → normalized bundle + 6-item score
                           2. ──internal HTTP──> Agent runtime (Node, Pi SDK)
                                                    └ Solar reasoning → report / QA draft
                           3. persist + respond to frontend
```

Rules: `frontend → backend` allowed; `backend → agent` allowed;
`agent → backend` forbidden; `agent → production DB` forbidden.

### Pi SDK integration

- Package: `@earendil-works/pi-coding-agent` (npm, MIT, Node ≥ 22.19).
- **Solar support**: Pi SDK reaches Upstage Solar through a custom OpenAI-compatible
  provider registered by `agent/src/pi/piSession.ts` — default
  `baseUrl: "https://api.upstage.ai/v1"`, `api: "openai-completions"`, model id
  `solar-pro3`, and runtime API key from `UPSTAGE_API_KEY`.
- Pi SDK is a *coding* agent; for the bundle→report / QA task it runs with
  `noTools: "all"` and backend-provided JSON context only. The SDK is adopted now as the agent
  substrate even though report+QA are single-call tasks, because genuine multi-step
  autonomy (Option B / §8 self-driving loop) is the intended next milestone.
- Backend↔agent communication is **internal HTTP** (long-running agent service),
  not subprocess RPC — chosen so Pi session state survives and the autonomous
  scheduler can later be hosted in the same process.

### What changes from the PR1 subprocess architecture

- `agent/src/tools/runAnalysisPipeline.ts` → `POST /pipeline/trigger` (the cycle
  source) is **removed/inverted**: the backend service now calls the agent, the agent
  no longer calls the backend.
- A new agent HTTP server entrypoint is added under `agent/` (Node `http`-based).
- A QA bridge path is added (addresses `docs/10` deferred item #2).
- The `agent/` skeleton is re-homed onto the Pi SDK instead of hand-rolled contracts.

### Scope

- **In scope now**: report generation path + QA path, both routed frontend → backend
  service layer → agent.
- **Deferred**: the autonomous `disclosureScheduler` loop (§8) — hosted in the same
  long-running agent service in a later milestone.

### Demo implementation notes

- Start order: `agent` service → FastAPI backend → Next frontend.
- `POST /api/v1/reports` runs collector/analyzer first, then requires the Pi SDK
  service to rewrite the report narrative. Failure returns a typed error; it does not
  silently use the deterministic/Solar-only report as a substitute.
- `POST /qa` builds the same normalized bundle + analysis context, then requires the
  Pi SDK service to answer. Failure returns a typed error; it does not call legacy
  `backend/analyzer/qa.py` as fallback.
- All user-facing report/QA/error copy should speak as first-person `공시리`.
