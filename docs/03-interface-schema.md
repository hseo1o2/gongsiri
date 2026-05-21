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
