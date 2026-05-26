from __future__ import annotations

from fastapi import APIRouter
from fastapi.responses import JSONResponse
from starlette.concurrency import run_in_threadpool

from backend.analyzer.pipeline import CONTRACT_VERSION, run_pipeline_request
from backend.auth.dev_session import resolve_dev_user_id
from backend.services.report_envelope import build_typed_envelope, now_iso
from backend.storage.connection import get_repository_provider

router = APIRouter(prefix="/api/reports", tags=["report-cache"])


@router.get("/{corp_code}")
async def get_cached_report(corp_code: str):
    provider = get_repository_provider()
    cached = provider.report_cache.get(user_id=resolve_dev_user_id(), corp_code=corp_code)
    if cached is None:
        return JSONResponse(
            content={"ok": False, "error": {"code": "cache_miss"}},
            status_code=404,
        )
    return JSONResponse(content=cached, status_code=200)


@router.post("/{corp_code}/refresh")
async def refresh_report(corp_code: str):
    pipeline_req = {
        "corpCode": corp_code,
        "source": "refresh",
        "contractVersion": CONTRACT_VERSION,
    }
    response = await run_in_threadpool(
        run_pipeline_request,
        pipeline_req,
        trace_id=f"refresh-{corp_code}",
    )
    generated_at = now_iso()
    envelope = build_typed_envelope(corp_code, generated_at, response)
    provider = get_repository_provider()
    provider.report_cache.upsert(
        user_id=resolve_dev_user_id(),
        corp_code=corp_code,
        generated_at=generated_at,
        payload=envelope,
    )
    return JSONResponse(content=envelope, status_code=200)
