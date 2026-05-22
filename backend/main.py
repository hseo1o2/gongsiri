from datetime import UTC, datetime
from json import JSONDecodeError
from typing import Any
from uuid import uuid4

from fastapi import FastAPI, HTTPException, Request
from fastapi.responses import JSONResponse
from starlette.concurrency import run_in_threadpool

from backend.agent_client import AgentServiceError
from backend.agent_service import agent_failure_envelope, answer_qa_with_agent
from backend.analyzer.pipeline import CONTRACT_VERSION, run_pipeline_request
from backend.analyzer.qa import analyze_bundle
from backend.collector.normalize import (
    build_and_save_normalized_bundle,
    build_normalized_bundle,
)
from backend.collector.runtime_normalize import build_runtime_normalized_bundle
from backend.report_views import (
    build_manual_check_response,
    build_report_detail_response,
    build_report_list_response,
    normalize_corp_code,
    normalize_keyword,
    report_failure,
    resolve_report_view,
)


def _typed_pipeline_failure(
    code: str, message: str, *, source: str = "user", trace_id: str | None = None
) -> dict[str, Any]:
    return {
        "ok": False,
        "triggerSource": source,
        "traceId": trace_id or str(uuid4()),
        "contractVersion": CONTRACT_VERSION,
        "observedAt": datetime.now(UTC).isoformat().replace("+00:00", "Z"),
        "error": {"code": code, "message": message},
        "evidence": [],
    }


async def _read_pipeline_trigger_payload(request: Request) -> tuple[dict[str, Any], bool]:
    body = await request.body()
    if not body.strip():
        return {}, True

    try:
        payload = await request.json()
    except JSONDecodeError:
        raise ValueError("Request body must be valid JSON.") from None

    if payload is None:
        return {}, True
    if not isinstance(payload, dict):
        raise ValueError("Request body must be a JSON object.")
    return payload, False


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


app = FastAPI(title="Gongsiri A Data Pipeline")


@app.get("/")
def health_check():
    return {
        "status": "ok",
        "service": "gongsiri-a-pipeline",
    }


@app.get("/bundle/{keyword}")
def get_bundle(keyword: str):
    try:
        bundle = build_normalized_bundle(keyword)
        return bundle.model_dump()
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/bundle/{keyword}/save")
def save_bundle(keyword: str):
    try:
        result = build_and_save_normalized_bundle(keyword)
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


def _pipeline_status_code(response: dict[str, Any]) -> int:
    if response.get("ok"):
        return 200

    error = response.get("error")
    code = error.get("code") if isinstance(error, dict) else None
    if code in {"invalid_request", "corp_code_unresolved"}:
        return 400
    if code == "missing_env":
        return 503
    return 500


@app.post("/analysis/pipeline")
def run_analysis_pipeline(request: dict[str, Any]):
    response = run_pipeline_request(request, trace_id=request.get("traceId"))
    return JSONResponse(content=response, status_code=_pipeline_status_code(response))


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


def _resolve_qa_request(payload: dict[str, Any]) -> tuple[str, str | None, str | None]:
    question = str(payload.get("question") or "").strip()
    corp_code = normalize_corp_code(
        payload.get("corpCode") or payload.get("corp_code"), field_name="corpCode"
    )
    keyword = normalize_keyword(payload.get("keyword"), field_name="keyword")

    if not question:
        raise ValueError("question은 비어 있을 수 없습니다.")
    if not corp_code and not keyword:
        raise ValueError("corpCode 또는 keyword 중 하나는 반드시 필요합니다.")

    return question, corp_code, keyword


async def _run_pipeline_trigger_route(request: Request) -> JSONResponse:
    try:
        payload, _empty_body = await _read_pipeline_trigger_payload(request)
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
            payload, _ = await _read_pipeline_trigger_payload(request)
            source = str(payload.get("source") or "user") if isinstance(payload, dict) else "user"
        except Exception:
            pass
        return JSONResponse(
            content=_typed_pipeline_failure("invalid_request", str(exc), source=source),
            status_code=400,
        )
    except Exception as exc:
        return JSONResponse(
            content=_typed_pipeline_failure("pipeline_trigger_failed", str(exc), source="user"),
            status_code=200,
        )


@app.post("/pipeline/trigger")
async def trigger_analysis_pipeline(request: Request):
    return await _run_pipeline_trigger_route(request)


@app.post("/api/v1/reports")
async def create_report(request: Request):
    try:
        payload, _empty_body = await _read_pipeline_trigger_payload(request)
        view = resolve_report_view(payload)
        if view == "report-list":
            response = build_report_list_response(payload)
        elif view == "manual-check":
            response = build_manual_check_response(payload)
        else:
            response = await run_in_threadpool(build_report_detail_response, payload)

        if response.get("ok") is False:
            return JSONResponse(content=response, status_code=_pipeline_status_code(response))
        return JSONResponse(content=response, status_code=200)
    except OverflowError as exc:
        return JSONResponse(
            content=report_failure("batch_limit_exceeded", str(exc)),
            status_code=400,
        )
    except ValueError as exc:
        return JSONResponse(
            content=report_failure("invalid_request", str(exc)),
            status_code=400,
        )
    except AgentServiceError as exc:
        return JSONResponse(
            content=agent_failure_envelope(
                exc,
                trace_id=locals().get("payload", {}).get("traceId") or str(uuid4()),
                contract_version=CONTRACT_VERSION,
                observed_at=datetime.now(UTC).isoformat().replace("+00:00", "Z"),
                source=locals().get("payload", {}).get("source", "user"),
            ),
            status_code=exc.status_code,
        )
    except Exception as exc:
        return JSONResponse(
            content=report_failure("reports_route_failed", str(exc)),
            status_code=500,
        )


@app.post("/qa")
async def qa_route(request: Request):
    try:
        payload, _empty_body = await _read_pipeline_trigger_payload(request)
        question, corp_code, keyword = _resolve_qa_request(payload)
        bundle = await run_in_threadpool(
            build_runtime_normalized_bundle,
            keyword=keyword,
            corp_code=corp_code,
        )
        analysis_result = await run_in_threadpool(analyze_bundle, bundle)
        return await run_in_threadpool(
            answer_qa_with_agent,
            question=question,
            bundle=bundle,
            analysis_result=analysis_result,
            trace_id=str(payload.get("traceId") or uuid4()),
            contract_version=str(payload.get("contractVersion") or CONTRACT_VERSION),
        )
    except ValueError as exc:
        payload_source = "user"
        try:
            payload_source = str(payload.get("source") or "user")
        except Exception:
            pass
        return JSONResponse(
            content=_typed_pipeline_failure("invalid_request", str(exc), source=payload_source),
            status_code=400,
        )
    except AgentServiceError as exc:
        payload_trace_id = ""
        payload_source = "user"
        try:
            payload_trace_id = str(payload.get("traceId") or "")
            payload_source = str(payload.get("source") or "user")
        except Exception:
            pass
        return JSONResponse(
            content=agent_failure_envelope(
                exc,
                trace_id=payload_trace_id or str(uuid4()),
                contract_version=CONTRACT_VERSION,
                observed_at=datetime.now(UTC).isoformat().replace("+00:00", "Z"),
                source=payload_source,
            ),
            status_code=exc.status_code,
        )
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc
