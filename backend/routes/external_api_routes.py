from __future__ import annotations

from fastapi import APIRouter, Query
from fastapi.responses import JSONResponse

from backend.collector.adapters.external_api import (
    dart_evidence_snapshot,
    news_search_results,
    parse_research_preview,
    search_stock_results,
    trade_info_snapshot,
)
from backend.collector.adapters.external_registry import REGISTRY

router = APIRouter(tags=["external-api"])


@router.get("/api/v1/external-sources")
def list_external_sources() -> dict[str, object]:
    return {"ok": True, "items": [item.model_dump() for item in REGISTRY]}


@router.get("/api/stocks/search")
def stocks_search(q: str = Query(default="")) -> JSONResponse:
    result = search_stock_results(q)
    error_code = result.get("error", {}).get("code")
    status = (
        200
        if result.get("ok")
        else 429
        if error_code == "rate_limited"
        else 400
        if error_code in {"invalid_request", "not_found"}
        else 503
    )
    return JSONResponse(content=result, status_code=status)


@router.get("/api/v1/external/trade-info")
def external_trade_info(
    stock_code: str = Query(default=""), market: str = Query(default="")
) -> JSONResponse:
    result = trade_info_snapshot(stock_code, market)
    error_code = result.get("error", {}).get("code")
    status = (
        200
        if result.get("ok")
        else 429
        if error_code == "rate_limited"
        else 400
        if error_code == "invalid_request"
        else 503
    )
    return JSONResponse(content=result, status_code=status)


@router.get("/api/v1/external/news")
def external_news(query: str = Query(default="")) -> JSONResponse:
    result = news_search_results(query)
    error_code = result.get("error", {}).get("code")
    status = (
        200
        if result.get("ok")
        else 429
        if error_code == "rate_limited"
        else 400
        if error_code == "invalid_request"
        else 503
        if error_code == "source_unavailable"
        else 424
    )
    return JSONResponse(content=result, status_code=status)


@router.get("/api/v1/external/dart/evidence")
def external_dart_evidence(corp_code: str = Query(default="")) -> JSONResponse:
    result = dart_evidence_snapshot(corp_code)
    error_code = result.get("error", {}).get("code")
    status = (
        200
        if result.get("ok")
        else 429
        if error_code == "rate_limited"
        else 400
        if error_code == "invalid_request"
        else 424
        if error_code == "missing_env"
        else 503
    )
    return JSONResponse(content=result, status_code=status)


@router.post("/api/v1/external/research/parse-preview")
def external_research_parse(payload: dict[str, object]) -> JSONResponse:
    file_path = str(payload.get("file_path") or "")
    result = parse_research_preview(file_path)
    error_code = result.get("error", {}).get("code")
    status = (
        200
        if result.get("ok")
        else 429
        if error_code == "rate_limited"
        else 400
        if error_code == "invalid_request"
        else 424
        if error_code == "missing_env"
        else 503
    )
    return JSONResponse(content=result, status_code=status)
