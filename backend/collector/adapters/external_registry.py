from __future__ import annotations

from backend.schemas.external_api import ExternalApiRegistryRow

REGISTRY: list[ExternalApiRegistryRow] = [
    ExternalApiRegistryRow(
        source_id="krx_stock_search",
        owner="A",
        endpoint="GET /api/stocks/search?q=...",
        env_vars=[],
        freshness="best-effort read-through local master; remote distillation source only on miss",
        rate_policy=(
            "Remote lookup may return rate_limited; local master fallback remains preferred."
        ),
        error_codes=["invalid_request", "not_found", "rate_limited", "source_unavailable"],
        output_schema="stock_search_result[]",
        reasoning_boundary=(
            "Returns normalized facts only; no investment recommendation or narrative scoring."
        ),
        distillation_note=(
            "k-skill endpoint idea is distilled into our read-only search contract; "
            "no dependency vendoring."
        ),
    ),
    ExternalApiRegistryRow(
        source_id="krx_trade_info",
        owner="A",
        endpoint="GET /api/v1/external/trade-info?stock_code=...&market=...",
        env_vars=[],
        freshness=(
            "latest cached trade snapshot with optional remote refresh when market is provided"
        ),
        rate_policy=(
            "Upstream 429 maps to rate_limited; callers may treat cache-only snapshots as degraded."
        ),
        error_codes=["invalid_request", "rate_limited", "source_unavailable"],
        output_schema="trade_info_snapshot",
        reasoning_boundary="Returns normalized price/volume facts for checklist evidence only.",
        distillation_note=(
            "k-skill trade-info semantics are rewritten into deterministic snapshot fields."
        ),
    ),
    ExternalApiRegistryRow(
        source_id="naver_news",
        owner="A",
        endpoint="GET /api/v1/external/news?query=...",
        env_vars=["NAVER_CLIENT_ID", "NAVER_CLIENT_SECRET"],
        freshness="latest sorted query results from Naver news search",
        rate_policy=(
            "Naver 429 or throttle responses map to rate_limited and should not be hidden "
            "as empty results."
        ),
        error_codes=[
            "invalid_request",
            "missing_env",
            "rate_limited",
            "source_unavailable",
            "no_results",
        ],
        output_schema="news_article[]",
        reasoning_boundary=(
            "Returns article facts/citations only; agent turns them into narrative later."
        ),
        distillation_note=(
            "k-skill/news query ideas remain reference-only; our adapter owns auth, shape, "
            "and error policy."
        ),
    ),
    ExternalApiRegistryRow(
        source_id="opendart_evidence",
        owner="A",
        endpoint="GET /api/v1/external/dart/evidence?corp_code=...",
        env_vars=["DART_API_KEY"],
        freshness="current filing list plus requested financial snapshot",
        rate_policy=(
            "OpenDART throttle/quota failures map to rate_limited; other upstream failures "
            "map to source_unavailable."
        ),
        error_codes=["invalid_request", "missing_env", "rate_limited", "source_unavailable"],
        output_schema="dart_filing_evidence[] + financial_snapshot",
        reasoning_boundary=(
            "Collector only maps filings/financial facts; no recommendation language."
        ),
        distillation_note=(
            "OpenDART endpoint usage is first-party; normalized criterion evidence links "
            "remain backend-owned."
        ),
    ),
    ExternalApiRegistryRow(
        source_id="document_parse_research",
        owner="A/B",
        endpoint="POST /api/v1/external/research/parse-preview",
        env_vars=["UPSTAGE_API_KEY"],
        freshness="on-demand parse of caller-provided local/ingested research artifact",
        rate_policy="Document Parse quota or 429-like upstream failures map to rate_limited.",
        error_codes=["invalid_request", "missing_env", "rate_limited", "source_unavailable"],
        output_schema="external_research_report",
        reasoning_boundary="Parsed sections/tables are evidence only, never final answer text.",
        distillation_note=(
            "Daishin/source selection and Document Parse remain explicit evidence adapters, "
            "not narrative generators."
        ),
    ),
]
