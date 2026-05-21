# Issue Backlog — Agent Pipeline Takeover Deferred Work

This backlog records deferred work from `prd-agent-pipeline-takeover.md` / `test-spec-agent-pipeline-takeover.md` so the current slice can stay narrow: no frontend UI edits, no new package manager workspace/lock policy changes, no backend Solar fallback deletion, and no new tools beyond the existing disclosure/pipeline/Solar seams.

## Non-negotiable guardrails for follow-up issues

- Do not edit frontend UI paths (`frontend/components/**`, CSS, or `frontend/app/**` outside API routes) unless a future task explicitly changes that guardrail.
- Follow upstream lock policy: do not introduce `pnpm-lock.yaml`, workspace files, or alternate package-manager locks unless upstream already adopts them in the target branch.
- Preserve backend Solar fallback until the agent-owned Solar seam is verified end-to-end and has replacement coverage.
- Use existing tools first: `fetch_disclosures`, `run_analysis_pipeline`, and `chat_with_solar`.
- Keep tests local to the area changed (`agent/test`, `backend/tests`, or existing root `tests/` where relocation is deferred).

## Deferred issues

### 1. Fully migrate backend Solar reasoning into the disclosure expert agent

- **Type:** migration / cleanup
- **Why deferred:** Removing backend Solar now would be destructive while the agent-owned `chat_with_solar` seam is still stabilizing.
- **Acceptance criteria:**
  - STEP1/STEP2/QA prompt construction and Solar calls are owned by agent skill/system-prompt/tool modules.
  - Backend analyzer keeps only normalization, scoring support, or compatibility wrappers required by API contracts.
  - Backend Solar fallback removal is covered by regression tests or an explicit compatibility replacement.
  - Existing backend Solar fallback tests are replaced or migrated, not silently deleted.

### 2. Productize `/qa` through the disclosure expert agent

- **Type:** feature
- **Why deferred:** QA productization is adjacent to the pipeline takeover but not required for the empty-body trigger and trigger-policy slices.
- **Acceptance criteria:**
  - QA requests flow through the disclosure expert agent and `chat_with_solar` seam.
  - Responses are machine-readable and include trace ID, contract version, and evidence/failure envelopes.
  - Backend QA compatibility remains available until frontend/API consumers are migrated.

### 3. Add DB persistence, auth, and real notification delivery

- **Type:** infrastructure / product hardening
- **Why deferred:** Current pipeline prepares persistence and notification payloads but intentionally avoids production side effects.
- **Acceptance criteria:**
  - Persistence writes are authenticated, auditable, and idempotent by trace ID or disclosure ID.
  - Notification delivery is opt-in/configured and has dry-run tests.
  - Failure modes do not erase analysis results or disclosure fetch evidence.

### 4. Broad de-mock and end-to-end smoke coverage

- **Type:** test hardening
- **Why deferred:** CI must not depend on live DART/Solar/network credentials; deterministic contract tests are the current priority.
- **Acceptance criteria:**
  - Contract tests remain deterministic with stubbed DART/Solar responses.
  - Optional live smoke tests are explicitly marked/manual and skipped without credentials.
  - Existing bridge tests no longer depend on local `.env` state or mutable external data.

### 5. Move backend root tests into `backend/tests/` and update CI

- **Type:** test layout cleanup
- **Why deferred:** Broad test relocation is noisy and outside the current pipeline takeover slice.
- **Acceptance criteria:**
  - Backend tests live under `backend/tests/` or a documented package-local layout.
  - CI/test commands are updated in one migration commit.
  - Historical root `tests/` imports are either migrated or preserved through a documented compatibility path.

### 6. Frontend API body pass-through for real selected stocks

- **Type:** API integration
- **Why deferred:** Existing frontend API route sends an empty POST and must remain compatible without UI edits in this slice.
- **Acceptance criteria:**
  - API route can pass selected keyword/corpCode when the UI/data source supplies it.
  - Empty-body POST remains supported for demo/dev compatibility.
  - No frontend UI page/component/style changes are bundled with this backend/API contract work unless explicitly approved.

### 7. Replace agent pipeline subprocess bridge with HTTP-only contract everywhere

- **Type:** agent tool migration
- **Why deferred:** The trigger-policy slice can call an injected pipeline runner; complete bridge rewiring belongs to the pipeline-tool migration slice.
- **Acceptance criteria:**
  - `run_analysis_pipeline` descriptor and implementation describe the HTTP endpoint as primary.
  - Unit tests stub `fetch` or an injected HTTP client, not Python subprocess, for the primary path.
  - Non-2xx and malformed JSON responses map to typed pipeline failures.

## Verification checklist for this artifact

- Artifact exists at `.omx/plans/issue-backlog-agent-pipeline-takeover.md`.
- Required backlog topics are present: backend Solar migration/deletion, QA productization, DB/auth/notification, broad de-mock, test folder cleanup, and frontend API body pass-through.
- No frontend UI files are modified.
- No package-manager lock/workspace files are added.
- Backend Solar fallback files remain present.
