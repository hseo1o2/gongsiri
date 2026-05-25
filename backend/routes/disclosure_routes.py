from __future__ import annotations

from fastapi import APIRouter, Request
from fastapi.responses import JSONResponse
from starlette.concurrency import run_in_threadpool

from backend.collector.bridge.disclosures import run_fetch_disclosures_request
from backend.http_contracts import (
    pipeline_status_code,
    read_json_object,
    typed_pipeline_failure,
)

router = APIRouter(tags=["internal"])


@router.post("/internal/disclosures")
async def fetch_disclosures_internal(request: Request) -> JSONResponse:
    try:
        payload, _empty_body = await read_json_object(request)
    except ValueError as exc:
        return JSONResponse(
            content=typed_pipeline_failure("invalid_request", str(exc), source="system"),
            status_code=400,
        )

    response = await run_in_threadpool(
        run_fetch_disclosures_request,
        payload,
        trace_id=payload.get("traceId"),
    )
    return JSONResponse(content=response, status_code=pipeline_status_code(response))
