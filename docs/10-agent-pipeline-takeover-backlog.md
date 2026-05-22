# 10. Agent Pipeline Takeover — Deferred Backlog & Guardrails

## Purpose

This artifact captures the deferred work from the approved agent pipeline takeover PRD/test spec so the current implementation slice can stay narrow, reversible, and verifiable.

Source evidence:
- Approved PRD: `/Users/beomsu/Documents/01_Project/Upstage/Upstage ambassador/team project/gongsiri/.omx/plans/prd-agent-pipeline-takeover.md`
- Approved test spec: `/Users/beomsu/Documents/01_Project/Upstage/Upstage ambassador/team project/gongsiri/.omx/plans/test-spec-agent-pipeline-takeover.md`
- Tracked artifact location chosen for this repo: `docs/10-agent-pipeline-takeover-backlog.md` because `.omx/` is ignored by `.gitignore` and would not be available for normal code review.

## Non-Negotiable Guardrails

- **No frontend UI edits in the takeover slice.** Do not change `frontend/app/**` pages/layouts except `frontend/app/api/**` route handlers when an API-proxy-only compatibility change is explicitly needed. Do not change `frontend/components/**` or frontend CSS for this work.
- **Respect upstream lock policy.** Do not add a new `pnpm-lock.yaml`, workspace file, or package-manager lock that upstream does not already carry. The frontend currently has `frontend/package-lock.json`; preserve the existing package-manager boundary.
- **Preserve backend Solar fallback.** Do not delete `backend/analyzer/solar_client.py`, `backend/analyzer/solar_step1.py`, `backend/analyzer/solar_step2.py`, `backend/analyzer/qa.py`, or backend prompt assets until the agent-owned Solar seam is proven and a later migration explicitly approves removal.
- **Use existing tools first.** Prefer existing `fetch_disclosures` and `chat_with_solar` seams over introducing new tool names. Legacy agent-side pipeline trigger surfaces are removed.
- **Keep tests local to the area when feasible.** New agent tests belong under `agent/test/`; new backend tests should prefer `backend/tests/`; broad root-test relocation remains deferred.

## Deferred Issue Backlog

### 1. Complete backend Solar migration and fallback deletion

- **Why deferred:** The current slice must keep backend analyzer behavior stable while the agent-owned Solar seam is introduced and tested.
- **Current evidence paths:** `backend/analyzer/solar_step1.py`, `backend/analyzer/solar_step2.py`, `backend/analyzer/qa.py`, `agent/src/tools/chatWithSolar.ts`.
- **Done when:** STEP1/STEP2/QA prompt construction and Solar calls are owned by agent skill/system-prompt modules, backend analyzer has a documented non-Solar compatibility role or is removed by an approved migration, and fallback deletion is covered by deterministic tests.

### 2. Productize `/qa` through the disclosure expert agent

- **Why deferred:** QA needs product-level context, persistence, and agent ownership beyond the minimal pipeline-trigger takeover.
- **Current evidence paths:** `backend/analyzer/qa.py`, `docs/05-feature-spec.md` (`R-04`), `docs/09-frontend-plan.md` (`qa/route.ts`).
- **Done when:** A typed `/qa` API path delegates to the disclosure expert agent seam, returns evidence-backed Korean answers, handles malformed Solar output, and records follow-up history when persistence exists.

### 3. Add DB persistence, auth, and real notification delivery

- **Why deferred:** The PRD excludes DB/auth/notification delivery from the current slice; preparation DTOs already exist without side effects.
- **Current evidence paths:** `backend/analyzer/preparation.py`, `docs/05-feature-spec.md` (`AUTH-*`, `D-04`, `R-01`, `R-02`, `PF-02`), `docs/07-pi-agent-contracts.md` preparation payload contract.
- **Done when:** User/watchlist/report/QA/agent-run persistence tables or services exist, auth protects user-scoped data, and notification delivery is explicit, observable, and tested without changing analyzer DTO semantics.

### 4. Broad de-mock of frontend data paths

- **Why deferred:** Frontend UI changes are explicitly out of scope for the takeover slice; API compatibility should be solved behind existing UI behavior first.
- **Current evidence paths:** `docs/05-feature-spec.md` frontend implementation status, `frontend/app/page.tsx`, `frontend/lib/types.ts`, `frontend/app/api/**`.
- **Done when:** Mock report/watchlist/portfolio data paths are replaced by typed API-backed data flows, without changing visual design contracts unless a frontend-specific PR approves UI work.

### 5. Clean up test folder structure

- **Why deferred:** Broad movement of existing root backend tests is noisy and can destabilize CI during the takeover slice.
- **Current evidence paths:** root `tests/`, proposed `backend/tests/` in the approved test spec, `.github/workflows/ci.yml`.
- **Done when:** Backend tests are moved or mirrored under `backend/tests/`, CI path discovery is updated, imports still work from a clean checkout, and root `tests/` is either removed or documented as legacy.

### 6. Frontend API body pass-through for real selected stocks

- **Why deferred:** Empty-body compatibility is required so the existing frontend API route keeps working; real selected-stock pass-through may require frontend route or state changes and should be isolated.
- **Current evidence paths:** `frontend/app/api/pipeline/trigger/route.ts`, `frontend/lib/types.ts`, approved `/pipeline/trigger` request contract.
- **Done when:** The API route can pass selected `keyword` or `corpCode` to the backend without UI regressions, empty-body behavior remains typed, and user-selected stock behavior has an end-to-end smoke check.

## Required Guardrail Verification for Takeover PRs

Run this before claiming a takeover slice is complete:

```bash
git diff --name-only | awk '
  /^frontend\/components\// ||
  /^frontend\/.*\.css$/ ||
  (/^frontend\/app\// && $0 !~ /^frontend\/app\/api\//) {
    print; bad=1
  }
  END { exit bad ? 1 : 0 }
'
```

Expected result: no output and exit code `0`. If `frontend/app/api/**` changes, document why backend-only compatibility was insufficient.

## Review Notes

- This file is intentionally tracked under `docs/` rather than `.omx/plans/` because `.omx/` is local runtime state in this repository.
- These items should become GitHub issues when repository authentication and issue ownership are available; until then this document is the durable backlog artifact.
