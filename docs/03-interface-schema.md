# 03. Interface Schema — Domain vs Pi Runtime

## Purpose
Python domain payload truth와 Pi runtime envelope truth를 분리해 contract drift를 막는다.

## Authority Split
- `backend/schemas/bundle.py` owns Python domain models such as `CompanyInfo`, `DisclosureItem`, and `NormalizedDataBundle`.
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
