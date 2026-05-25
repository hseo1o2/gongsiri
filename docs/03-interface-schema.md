# 03. Interface Schema — Domain vs Pi Runtime

## Purpose

Python domain payload truth와 Pi runtime envelope truth를 분리해 contract drift를 막는다.

## Authority Split

- `backend/schemas/bundle.py` owns Python domain models such as `CompanyInfo`, `DisclosureItem`, and `NormalizedDataBundle`.
- `backend/schemas/analysis.py` owns Python analyzer and preparation-boundary models such as `ChecklistItem`, `AnalysisResult`, `PreparedPersistencePayload`, and `PreparedNotificationPayload`.
- `docs/07-pi-agent-contracts.md` owns Pi runtime request/response envelopes.
- TypeScript runtime contracts must reference these docs instead of redefining Python domain truth ad hoc.

## Existing Python Domain Schemas

### `CompanyInfo`

Source: `backend/schemas/bundle.py`

Fields:

- `corp_name: str`
- `stock_code: str`
- `corp_code?: str`
- `market?: str`

### `DisclosureItem`

Source: `backend/schemas/bundle.py`

Fields:

- `rcept_no: str`
- `report_nm: str`
- `rcept_dt: str`
- `parsed_text?: str`
- `url?: str`
- `category?: str`

## Pi ↔ Python Bridge Request Shape

Canonical bridge request for PR1 disclosure fetch:

```json
{
  "keyword": "카카오",
  "bgnDe": "20240101",
  "endDe": "20241231",
  "pageCount": 20
}
```

or

```json
{
  "corpCode": "00258801",
  "bgnDe": "20240101",
  "endDe": "20241231",
  "pageCount": 20
}
```

Resolution precedence:

1. `corpCode` present → direct path
2. `keyword` only → read-only corp code resolution first
3. both present → `corpCode` wins
4. unresolved corp code → typed failure `corp_code_unresolved`

## Pi ↔ Python Bridge Response Shape

Source implementation: `backend/collector/bridge/disclosures.py`

Success envelope:

- `ok: true`
- `traceId: string`
- `contractVersion: "v1"`
- `observedAt: ISO-8601 UTC string`
- `data.corpCode: string`
- `data.company: CompanyInfo | null`
- `data.disclosures: DisclosureItem[]`
- `evidence: object[]`

Failure envelope:

- `ok: false`
- `traceId: string`
- `contractVersion: "v1"`
- `observedAt: ISO-8601 UTC string`
- `error.code: string`
- `error.message: string`
- `evidence: []`

## Error Code Set for PR1

- `invalid_request`
- `corp_code_unresolved`
- `missing_env`
- `dart_api_error`
- `bridge_process_failed`
- `bridge_malformed_output` (reserved for TS runner parsing layer)

## Side-Effect Constraint

- Runtime disclosure fetch must not mutate `assets/stock_master.json`.
- PR1 read-only resolution uses `backend/collector/company_resolver.py`.
- Persistent lookup behavior in `backend/collector/krx/search.py` is legacy collector behavior, not the Pi runtime path.

## G001 Screen-MVP HTTP Contract Authority

Source of truth for the screen-MVP HTTP slice:

- `backend/openapi.json` owns the HTTP contract for `POST /api/v1/reports`
- `frontend/lib/api/**` consumes that contract through typed client helpers
- existing `backend/schemas/**` remain Python-domain truth, not page-specific HTTP truth

Guardrails:

- FastAPI is the single HTTP source of truth
- API namespace is `/api/v1`
- no DB persistence in this slice
- no auth or user-scoped envelopes in this slice
- no report-history persistence contract in this slice
- manual-check batch requests must reject over 20 corp codes with HTTP 400

### Mixed-shape policy for `POST /api/v1/reports`

One route serves multiple report-page reads, but the request/response body must remain explicitly discriminated by `view`.

Request modes:

- `view: "report-list"` — report list page cold-load/read path
- `view: "report-detail"` — single corp report detail read path
- `view: "manual-check"` — batch-trigger/read path for “지금 체크”

Response policy:

- every success payload echoes the `view`
- list/detail/manual-check each return a page-specific shape
- cold-load fallback is explicit via `fallback.used` + `fallback.reason`
- once report cache exists, `report-list` and cached `report-detail` may return `fallback.used: false`

### Report list response shape

Purpose: feed `frontend/app/(app)/report/page.tsx` without requiring report-history persistence.

```ts
type ReportListResponse = {
  view: "report-list";
  reports: Array<{
    corpCode: string;
    corpName: string;
    analyzedAt: string;
    riskLevel: "normal" | "caution" | "high";
    riskScore: number;
  }>;
  fallback: {
    used: boolean;
    reason?: "cold_start_no_cached_reports";
  };
};
```

### Report detail response shape

Purpose: feed `frontend/app/(app)/report/[corpCode]/page.tsx`.

```ts
type ReportDetailResponse = {
  view: "report-detail";
  report: {
    corpCode: string;
    corpName: string;
    analyzedAt: string;
    riskLevel: "normal" | "caution" | "high";
    riskScore: number;
    checklist: ChecklistItem[];
    shortTermReport: string;
    longTermReport?: string;
    disclaimer: string;
    missingEvidence: string[];
  };
  fallback: {
    used: boolean;
    reason?: "cold_start_generated_detail";
  };
};
```

G007 cache rule:

- `report-detail` must read saved detail first when a cached row exists for the requested `corpCode`;
- explicit reanalyze/refresh may bypass cache and overwrite the saved row;
- agent failure must not write fake success rows.

### Manual-check response shape

Purpose: feed the dashboard “지금 체크” interaction without adding separate route families in this slice.

```ts
type ManualCheckResponse = {
  view: "manual-check";
  acceptedCorpCodes: string[];
  maxBatchSize: 20;
  fallback: {
    used: boolean;
    reason?: "read_only_manual_check";
  };
};
```

## G003 Analyzer Schema Authority

Source implementation target: `backend/schemas/analysis.py`

### `ChecklistItem`

Required fields:

- `id: str`
- `title: str`
- `status: "pass" | "fail" | "unknown"`
- `score: int`
- `reason: str`
- `evidence: list[str]`
- `evidence_refs: Array<{ label: str; source: str; observed_at?: str | None }>`
- `source: str` (`"deterministic_backend"` in G006)
- `observed_at?: str | None`
- `solar_explanation: str` — agent `gongsiri-checklist-explanation` skill 산출 Markdown.
  `backend/analyzer/run_step1` 반환 시점에는 빈 문자열(`""`),
  `attach_agent_report` 단계에서 agent skill 결과로 채워진다.
  backend LLM 이 직접 생성하지 않는다 (G010).

Interpretation:

- `risk_score` / `risk_level` / checklist `score` remain **deterministic backend truth**
- structured checklist facts are reusable for UI/storage/QA
- agent-written Markdown explanation is a **separate surface** and must not overwrite numeric guard fields

### `AnalysisResult`

Required fields:

- `risk_score: int`
- `risk_level: "normal" | "caution" | "high"`
- `checklist: ChecklistItem[]`
- `short_term_report: str`
- `long_term_report: str`
- `disclaimer: str`
- `missing_evidence: list[str]`

### Preparation-only boundary payloads

- `PreparedPersistencePayload`
- `PreparedNotificationPayload`

These are interface/boundary models only for G003 and must not imply real DB writes or delivery.

## Demo Backend ↔ Pi SDK Agent Seam

Source contract: `docs/07-pi-agent-contracts.md` → "Demo Pi SDK HTTP Service Contract".

For the browser demo, FastAPI remains the only frontend-facing HTTP surface. The backend
may call the local Pi SDK agent service internally after it has produced:

- `normalizedDataBundle` from collector/runtime normalization
- `analysisResult` from analyzer/checklist scoring
- optional `preparation` DTOs

Guardrails:

- Frontend must not call the agent service directly.
- The Pi SDK agent service must not call backend HTTP routes.
- Report and QA paths are strict Pi SDK-first; typed agent failures must not be hidden by legacy Solar-only fallback.
- User-facing narrative/error text must speak in first person as `공시리`.

G006 boundary example:

```ts
type AgentAnalysisGuard = {
  riskScore: number;
  riskLevel: "normal" | "caution" | "high";
  checklistIds: string[];
};

type AgentChecklistExplanationResult = {
  mode: "checklist_explanation";
  markdown: string;
  data: {
    checklistExplanation: {
      summaryMarkdown: string;
      items: Array<{ id: string; markdown: string }>;
    };
    analysisGuard: AgentAnalysisGuard;
  };
};
```

The backend may merge Markdown fields from the agent, but it must reject or ignore any response that attempts to alter `riskScore`, `riskLevel`, or checklist IDs relative to backend deterministic truth.

## G009 External API Data Plane Boundary

Source contract: `docs/12-external-api-registry.md`; implementation surface:

- `backend/schemas/external_api.py`
- `backend/collector/adapters/external_registry.py`
- `backend/collector/adapters/external_api.py`
- `backend/routes/external_api_routes.py`

Rules:

- deterministic REST/source adapters fetch and normalize facts;
- 공시리 agent consumes normalized JSON facts and must not browse raw external sources directly for these paths;
- typed degraded/unavailable states are part of the contract, not exceptional hidden behavior;
- k-skill remains a distillation reference only, not a shipped dependency.

## G010 Narrative Ownership Boundary

Backend analyzer truth after G010:

- deterministic `risk_score`, `risk_level`, checklist facts, and preparation DTOs remain backend-owned
- final Markdown narrative fields (`short_term_report`, `long_term_report`, Q&A answer, checklist explanation Markdown) are 공시리 agent outputs over normalized facts
- typed agent failures must surface instead of reviving legacy Solar-only fallback prose

## G007 Report Cache / QA History Boundary

Backend persistence after real success:

- `POST /api/v1/reports` with `view: "report-detail"` may save generated detail into `analysis_reports`
- `GET /api/v1/qa-history?corp_code=...` returns saved Q&A history scoped to the dev user and optional corp code
- frontend BFF `POST /api/qa` proxies to backend `POST /qa`
- backend `POST /qa` saves Q&A only after a real 공시리 answer succeeds

## Dashboard Watchlist Price Enrichment

`GET /api/v1/dev/dashboard` 응답의 `watchlist` 각 항목에 실시간 주가 필드가 추가된다.

| 필드          | 타입             | 설명                                             |
| ------------- | ---------------- | ------------------------------------------------ |
| `price`       | `number \| null` | 최신 영업일 종가(close_price). 조회 실패 시 null |
| `change_rate` | `number \| null` | 등락률(%). 조회 실패 시 null                     |

**구현 경로**: `backend/collector/krx/trade_info.fetch_latest_price` → k-skill-proxy `GET /v1/korean-stock/trade-info`

**동작 방식**:

- `_watchlist_views()` 호출 시 `ThreadPoolExecutor(max_workers=5)`로 워치리스트 전 종목 병렬 조회
- `as_completed(timeout=6)` 상한 적용 — 6초 내 응답 없는 종목은 null 처리
- stock_code 또는 market 없는 항목은 즉시 null
- 네트워크 오류·비정상 응답 등 모든 예외는 null로 흡수하여 대시보드 전체 장애 방지
- `add_watchlist_item()` 단건 응답은 price/change_rate 기본값 null (즉시 조회 불필요)

## Dev DB Persistence Contract (#44)

Source contract: `docs/11-dev-db-contract.md`; source implementation: `backend/storage/schema.py` and `backend/storage/repositories.py`.

The dev DB contract is backend-internal and does not replace API DTO truth in this file or Pi runtime envelope truth in `docs/07-pi-agent-contracts.md`. FastAPI routes must depend on repository ports instead of SQLite details so a later Supabase adapter can be added without frontend or agent direct DB access.

Guardrails:

- default first pass is local SQLite/in-memory, not Supabase;
- `source_version` and ISO timestamp fields support stale/cache semantics;
- report/QA cache rows may only represent real pipeline + Pi SDK agent outputs, not fake fallback success;
- the agent service never calls DB repositories directly.

## Dev Auth Session Contract (#28/#42)

Source contract: `docs/11-dev-db-contract.md`; backend route: `POST /api/v1/dev/auth/login`; frontend BFF route: `POST /api/auth/login`.

Request:

```ts
type DevAuthLoginRequest = {
  username: string;
  password: string;
};
```

Success response:

```ts
type DevAuthLoginResponse = {
  ok: true;
  authMode: "dev";
  session: {
    userId: string;
    username: string;
    role: "admin" | string;
    displayName: string;
    expiresInSeconds: number;
  };
  token: `dev-session:${string}`;
  expiresInSeconds: number;
  evidence: Array<{
    source: "dev_db_users";
    userId: string;
    sourceVersion: string;
  }>;
};
```

Failure response uses the existing typed error style:

```ts
type DevAuthFailure = {
  ok: false;
  authMode: "dev";
  observedAt: string;
  error: {
    code: "dev_auth_disabled" | "invalid_request" | "invalid_credentials";
    message: string;
  };
};
```

Guardrails:

- `GONGSIRI_AUTH_MODE=dev` is required for the seeded `admin/admin` path; unset means disabled.
- The returned token is a dev-session marker stored by the frontend in an HTTP-only cookie, not a production JWT or secret.
- Signup remains a UX shell until production auth work is explicitly scoped.
