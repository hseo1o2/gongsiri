from __future__ import annotations

from datetime import UTC, datetime
from json import JSONDecodeError
from typing import Any
from uuid import uuid4

from fastapi import Request

from backend.analyzer.pipeline import CONTRACT_VERSION


async def read_json_object(request: Request) -> tuple[dict[str, Any], bool]:
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


def typed_pipeline_failure(
    code: str, message: str, *, source: str = "user", trace_id: str | None = None
) -> dict[str, Any]:
    return {
        "ok": False,
        "triggerSource": source,
        "traceId": trace_id or str(uuid4()),
        "contractVersion": CONTRACT_VERSION,
        "observedAt": utc_now(),
        "error": {"code": code, "message": message},
        "evidence": [],
    }


def pipeline_status_code(response: dict[str, Any]) -> int:
    if response.get("ok"):
        return 200
    error = response.get("error")
    code = error.get("code") if isinstance(error, dict) else None
    if code in {"invalid_request", "corp_code_unresolved"}:
        return 400
    if code == "missing_env":
        return 503
    return 500


def utc_now() -> str:
    return datetime.now(UTC).isoformat().replace("+00:00", "Z")
