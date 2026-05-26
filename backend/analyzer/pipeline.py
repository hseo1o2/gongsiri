from __future__ import annotations

from datetime import UTC, datetime
from typing import Any, Mapping
from uuid import uuid4

from backend.analyzer.preparation import build_notification_payload, build_persistence_payload
from backend.analyzer.qa import analyze_bundle
from backend.collector.runtime_normalize import build_runtime_normalized_bundle
from backend.schemas.analysis import PipelineResultData

CONTRACT_VERSION = "v2"


class InvalidPipelineRequestError(ValueError):
    code = "invalid_request"


def _observed_at(now: datetime | None = None) -> str:
    current = now or datetime.now(UTC)
    return current.isoformat().replace("+00:00", "Z")


def _failure(
    code: str, message: str, trace_id: str, observed_at: str, trigger_source: str
) -> dict[str, Any]:
    return {
        "ok": False,
        "triggerSource": trigger_source,
        "traceId": trace_id,
        "contractVersion": CONTRACT_VERSION,
        "observedAt": observed_at,
        "error": {"code": code, "message": message},
        "evidence": [],
    }


def _map_exception(exc: Exception) -> tuple[str, str]:
    code = getattr(exc, "code", None)
    if code:
        return code, str(exc)

    message = str(exc)

    if "DART_API_KEY" in message:
        return "missing_env", message
    if "corp code를 확인할 수 없습니다" in message or "종목 검색 실패" in message:
        return "corp_code_unresolved", message

    return "analysis_failed", message


def run_pipeline_request(
    request: Mapping[str, Any],
    *,
    trace_id: str | None = None,
    now: datetime | None = None,
) -> dict[str, Any]:
    current_trace_id = trace_id or str(uuid4())
    observed_at = _observed_at(now)
    trigger_source = str(request.get("source") or "system")
    keyword = str(request.get("keyword") or "").strip() or None
    corp_code = str(request.get("corpCode") or "").strip() or None

    if not keyword and not corp_code:
        return _failure(
            "invalid_request",
            "keyword 또는 corpCode 중 하나는 반드시 필요합니다.",
            current_trace_id,
            observed_at,
            trigger_source,
        )

    try:
        bundle = build_runtime_normalized_bundle(keyword=keyword, corp_code=corp_code)
        analysis_result = analyze_bundle(bundle)
        persistence_payload = build_persistence_payload(
            bundle, analysis_result, trace_id=current_trace_id, trigger_source=trigger_source
        )
        notification_payload = build_notification_payload(
            bundle, analysis_result, trigger_source=trigger_source
        )

        result_data = PipelineResultData(
            normalized_data_bundle=bundle,
            analysis_result=analysis_result,
            preparation={
                "persistence": persistence_payload,
                "notification": notification_payload,
            },
        )

        return {
            "ok": True,
            "triggerSource": trigger_source,
            "traceId": current_trace_id,
            "contractVersion": CONTRACT_VERSION,
            "observedAt": observed_at,
            "result": result_data.model_dump(),
            "evidence": [
                {
                    "source": "runtime_normalize",
                    "corpCode": bundle.company.corp_code,
                    "missingFields": bundle.missing_fields,
                },
                {
                    "source": "analyzer",
                    "riskScore": analysis_result.risk_score,
                    "riskLevel": analysis_result.risk_level,
                },
            ],
        }
    except Exception as exc:
        code, message = _map_exception(exc)
        return _failure(code, message, current_trace_id, observed_at, trigger_source)
