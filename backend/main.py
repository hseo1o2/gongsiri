from json import JSONDecodeError
from typing import Any

from fastapi import FastAPI, HTTPException, Request
from fastapi.responses import JSONResponse

from backend.analyzer.pipeline import CONTRACT_VERSION, run_pipeline_request
from backend.collector.normalize import (
    build_and_save_normalized_bundle,
    build_normalized_bundle,
)
def _typed_pipeline_failure(code: str, message: str, *, source: str = "user") -> dict[str, Any]:
    return {
        "ok": False,
        "triggerSource": source,
        "traceId": "",
        "contractVersion": CONTRACT_VERSION,
        "observedAt": "",
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
