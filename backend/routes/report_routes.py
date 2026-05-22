from __future__ import annotations

from uuid import uuid4

from fastapi import Request
from fastapi.responses import JSONResponse
from starlette.concurrency import run_in_threadpool

from backend.agent_client import AgentServiceError
from backend.agent_service import agent_failure_envelope
from backend.analyzer.pipeline import CONTRACT_VERSION
from backend.auth.dev_session import require_dev_auth_mode
from backend.http_contracts import pipeline_status_code, read_json_object, utc_now
from backend.report_views import (
    build_manual_check_response,
    build_report_detail_response,
    build_report_list_response,
    report_failure,
    resolve_report_view,
)


async def create_report_response(request: Request) -> JSONResponse:
    failure = require_dev_auth_mode()
    if failure is not None:
        return failure
    try:
        payload, _empty_body = await read_json_object(request)
        view = resolve_report_view(payload)
        if view == "report-list":
            response = build_report_list_response(payload)
        elif view == "manual-check":
            response = build_manual_check_response(payload)
        else:
            response = await run_in_threadpool(build_report_detail_response, payload)
        if response.get("ok") is False:
            return JSONResponse(content=response, status_code=pipeline_status_code(response))
        return JSONResponse(content=response, status_code=200)
    except OverflowError as exc:
        return JSONResponse(
            content=report_failure(
                "batch_limit_exceeded", str(exc), contract_version=CONTRACT_VERSION
            ),
            status_code=400,
        )
    except ValueError as exc:
        return JSONResponse(
            content=report_failure("invalid_request", str(exc), contract_version=CONTRACT_VERSION),
            status_code=400,
        )
    except AgentServiceError as exc:
        payload = locals().get("payload", {})
        return JSONResponse(
            content=agent_failure_envelope(
                exc,
                trace_id=payload.get("traceId") or str(uuid4()),
                contract_version=CONTRACT_VERSION,
                observed_at=utc_now(),
                source=payload.get("source", "user"),
            ),
            status_code=exc.status_code,
        )
    except Exception as exc:
        return JSONResponse(
            content=report_failure(
                "reports_route_failed", str(exc), contract_version=CONTRACT_VERSION
            ),
            status_code=500,
        )
