# 12. External API Registry — Deterministic Data Plane Boundary

## Purpose

G009 (#34-#38) defines the boundary between:
- **data plane** — deterministic backend adapters that fetch and normalize facts
- **reasoning plane** — 공시리 agent prompts/tools that explain those facts but do not browse raw web sources

This registry is the source of truth for which external sources exist, who owns them, what env vars they need, how stale they may be, and which typed degraded/unavailable states callers must expect.

## Guardrails

- Frontend talks only to backend HTTP routes.
- Backend adapters return normalized facts and typed failures only.
- 공시리 agent consumes normalized JSON context, not raw browsing obligations.
- k-skill is a **distillation source only**: endpoint ideas and payload patterns may be adapted, but no k-skill dependency is installed or vendored.
- Missing API credentials, rate limits, empty results, and upstream outages must be represented as typed states (`invalid_request`, `missing_env`, `no_results`, `source_unavailable`, etc.).

## Registry rows

| source_id | Owner | Backend endpoint | Env vars | Freshness | Rate policy | Output schema | Typed degraded states | Reasoning boundary |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `krx_stock_search` | A | `GET /api/stocks/search?q=...` | — | Local master first, remote read-through on miss | Remote lookup may return `rate_limited`; local master fallback remains preferred. | `stock_search_result[]` | `invalid_request`, `not_found`, `rate_limited`, `source_unavailable` | Search facts only. No narrative or recommendation text. |
| `krx_trade_info` | A | `GET /api/v1/external/trade-info?stock_code=...&market=...` | — | Cached trade snapshot, optional remote refresh | Upstream 429 maps to `rate_limited`; callers may treat cache-only snapshots as degraded. | `trade_info_snapshot` | `invalid_request`, `rate_limited`, `source_unavailable` | Price/volume evidence only for checklist criterion #4. |
| `naver_news` | A | `GET /api/v1/external/news?query=...` | `NAVER_CLIENT_ID`, `NAVER_CLIENT_SECRET` | Latest query results sorted by date | Naver throttle/429 responses map to `rate_limited` and must not be hidden as empty results. | `news_article[]` | `invalid_request`, `missing_env`, `rate_limited`, `no_results`, `source_unavailable` | Article facts/citations only. Narrative is deferred to 공시리. |
| `opendart_evidence` | A | `GET /api/v1/external/dart/evidence?corp_code=...` | `DART_API_KEY` | Current filing list + requested financial snapshot | OpenDART throttle/quota failures map to `rate_limited`; other upstream failures map to `source_unavailable`. | `dart_filing_evidence[]`, `financial_snapshot` | `invalid_request`, `missing_env`, `rate_limited`, `source_unavailable` | Filing/financial facts only. No investment language. |
| `document_parse_research` | A/B | `POST /api/v1/external/research/parse-preview` | `UPSTAGE_API_KEY` | On-demand parse preview for a local research artifact | Document Parse quota or 429-like upstream failures map to `rate_limited`. | `external_research_report` | `invalid_request`, `missing_env`, `rate_limited`, `source_unavailable` | Parsed sections/tables are evidence only, never final answer text. |

## Normalized schema summary

### `stock_search_result`
- `corp_name`
- `stock_code`
- `corp_code?`
- `market?`

### `trade_info_snapshot`
- `stock_code`
- `market`
- `monthly_return_max?`
- `volume_spike_ratio?`
- `latest_date?`

### `news_article`
- `title`
- `source`
- `url?`
- `published_at`
- `query`
- `matched_theme?`
- `summary`

### `dart_filing_evidence`
- `rcept_no`
- `report_nm`
- `rcept_dt`
- `category?`
- `url?`

### `financial_snapshot`
- `revenue?`
- `operating_income?`
- `equity?`

### `external_research_report`
- `source_url?`
- `parsed_sections[]`
- `extracted_tables[]`
- `key_points[]`

## Availability contract

Every adapter route returns a typed envelope with:
- `ok: boolean`
- `source_id: string`
- `availability: "available" | "degraded" | "unavailable"`
- `evidence[]`
- optional `error { code, message }`

Representative typed error codes:
- `invalid_request`
- `missing_env`
- `not_found`
- `no_results`
- `rate_limited`
- `source_unavailable`

Interpretation:
- `available` — returned normalized facts successfully
- `degraded` — returned a meaningful but partial state (for example, no results or cache-only snapshot)
- `unavailable` — caller should treat the source as failed for this request

## Current implementation surface

- Registry source: `backend/collector/adapters/external_registry.py`
- Typed wrappers: `backend/collector/adapters/external_api.py`
- Typed models: `backend/schemas/external_api.py`
- Backend routes: `backend/routes/external_api_routes.py`

## Distillation note

k-skill references inform:
- KRX search/trade-info parameter ideas
- error/rate-limit expectations
- endpoint naming inspiration

But the shipped contract is re-authored here and owned by this repo’s docs + tests.
