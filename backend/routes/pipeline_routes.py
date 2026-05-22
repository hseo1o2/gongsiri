from __future__ import annotations

from typing import Any

from fastapi import APIRouter, Request
from fastapi.responses import JSONResponse
from starlette.concurrency import run_in_threadpool

from backend.analyzer.pipeline import CONTRACT_VERSION, run_pipeline_request
from backend.http_contracts import read_json_object, typed_pipeline_failure

router = APIRouter(tags=["pipeline"])


def _append_route_default_evidence(result: dict[str, Any], default_keyword: str) -> dict[str, Any]:
    evidence = list(result.get("evidence") or [])
    evidence.append(
        {
            "source": "pipeline_trigger_route",
            "defaultUsed": True,
            "defaultKeyword": default_keyword,
        }
    )
    return {**result, "evidence": evidence}


def _resolve_pipeline_trigger_request(payload: dict[str, Any]) -> tuple[dict[str, Any], bool]:
    pipeline_request = dict(payload)
    default_used = False

    if not pipeline_request.get("source"):
        pipeline_request["source"] = "user"
    if not pipeline_request.get("contractVersion"):
        pipeline_request["contractVersion"] = CONTRACT_VERSION
    if not pipeline_request.get("keyword") and not pipeline_request.get("corpCode"):
        pipeline_request["keyword"] = "카카오"
        default_used = True

    return pipeline_request, default_used


@router.post("/pipeline/trigger")
async def trigger_analysis_pipeline(request: Request):
    try:
        payload, _empty_body = await read_json_object(request)
        pipeline_request, default_used = _resolve_pipeline_trigger_request(payload)
        response = await run_in_threadpool(
            run_pipeline_request,
            pipeline_request,
            trace_id=pipeline_request.get("traceId"),
        )
        if default_used and response.get("ok"):
            response = _append_route_default_evidence(response, "카카오")
        return JSONResponse(content=response, status_code=200)
    except ValueError as exc:
        source = "user"
        try:
            payload, _ = await read_json_object(request)
            source = str(payload.get("source") or "user") if isinstance(payload, dict) else "user"
        except Exception:
            pass
        return JSONResponse(
            content=typed_pipeline_failure("invalid_request", str(exc), source=source),
            status_code=400,
        )
    except Exception as exc:
        return JSONResponse(
            content=typed_pipeline_failure("pipeline_trigger_failed", str(exc), source="user"),
            status_code=200,
        )
