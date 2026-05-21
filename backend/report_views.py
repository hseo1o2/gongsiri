from __future__ import annotations

from datetime import UTC, datetime
from typing import Any
from uuid import uuid4

from backend.agent_service import attach_agent_report
from backend.analyzer.pipeline import CONTRACT_VERSION, run_pipeline_request

MAX_MANUAL_CHECK_BATCH_SIZE = 20
REPORT_VIEWS = {"report-list", "report-detail", "manual-check"}


def observed_at() -> str:
    return datetime.now(UTC).isoformat().replace("+00:00", "Z")


def report_failure(
    code: str,
    message: str,
    *,
    trace_id: str | None = None,
    contract_version: str = CONTRACT_VERSION,
    observed: str | None = None,
    evidence: list[dict[str, Any]] | None = None,
) -> dict[str, Any]:
    return {
        "ok": False,
        "traceId": trace_id or str(uuid4()),
        "contractVersion": contract_version,
        "observedAt": observed or observed_at(),
        "error": {"code": code, "message": message},
        "evidence": evidence or [],
    }


def resolve_report_view(payload: dict[str, Any]) -> str:
    view = str(payload.get("view") or "").strip()
    if view not in REPORT_VIEWS:
        raise ValueError("view는 report-list, report-detail, manual-check 중 하나여야 합니다.")
    return view


def build_report_list_response(payload: dict[str, Any]) -> dict[str, Any]:
    _corp_codes(payload)
    return {
        "view": "report-list",
        "reports": [],
        "fallback": {"used": True, "reason": "cold_start_no_cached_reports"},
    }


def build_manual_check_response(payload: dict[str, Any]) -> dict[str, Any]:
    corp_codes = _corp_codes(payload)
    if len(corp_codes) > MAX_MANUAL_CHECK_BATCH_SIZE:
        raise OverflowError(
            f"manual-check는 최대 {MAX_MANUAL_CHECK_BATCH_SIZE}개 종목까지 지원합니다."
        )
    return {
        "view": "manual-check",
        "acceptedCorpCodes": corp_codes,
        "maxBatchSize": MAX_MANUAL_CHECK_BATCH_SIZE,
        "fallback": {"used": True, "reason": "read_only_manual_check"},
    }


def build_report_detail_response(payload: dict[str, Any]) -> dict[str, Any]:
    corp_code = str(payload.get("corpCode") or "").strip()
    keyword = str(payload.get("keyword") or "").strip()
    if not corp_code and not keyword:
        raise ValueError("report-detail은 corpCode 또는 keyword 중 하나가 필요합니다.")

    pipeline_request = _pipeline_request(
        payload, corp_code=corp_code or None, keyword=keyword or None
    )
    pipeline_response = run_pipeline_request(
        pipeline_request, trace_id=pipeline_request.get("traceId")
    )
    if not pipeline_response.get("ok"):
        return pipeline_response

    agent_response = attach_agent_report(pipeline_response)
    return _detail_view(agent_response, requested_corp_code=corp_code or keyword)


def _pipeline_request(
    payload: dict[str, Any], *, corp_code: str | None, keyword: str | None
) -> dict[str, Any]:
    request: dict[str, Any] = {
        "source": str(payload.get("source") or "user"),
        "contractVersion": str(payload.get("contractVersion") or CONTRACT_VERSION),
    }
    if payload.get("traceId"):
        request["traceId"] = str(payload["traceId"])
    if corp_code:
        request["corpCode"] = corp_code
    elif keyword:
        request["keyword"] = keyword
    return request


def _corp_codes(payload: dict[str, Any]) -> list[str]:
    raw_codes = payload.get("corpCodes") or []
    if not isinstance(raw_codes, list):
        raise ValueError("corpCodes는 배열이어야 합니다.")
    return [str(code).strip() for code in raw_codes if str(code).strip()]


def _detail_view(agent_response: dict[str, Any], *, requested_corp_code: str) -> dict[str, Any]:
    result = agent_response.get("result") if isinstance(agent_response.get("result"), dict) else {}
    bundle = (
        result.get("normalized_data_bundle")
        if isinstance(result.get("normalized_data_bundle"), dict)
        else {}
    )
    company = bundle.get("company") if isinstance(bundle.get("company"), dict) else {}
    analysis = (
        result.get("analysis_result") if isinstance(result.get("analysis_result"), dict) else {}
    )

    return {
        "view": "report-detail",
        "report": {
            "corpCode": str(company.get("corp_code") or requested_corp_code),
            "corpName": str(company.get("corp_name") or requested_corp_code),
            "analyzedAt": str(agent_response.get("observedAt") or observed_at()),
            "riskLevel": _risk_level(analysis.get("risk_level")),
            "riskScore": analysis.get("risk_score") or 0,
            "checklist": _checklist(analysis.get("checklist")),
            "shortTermReport": str(analysis.get("short_term_report") or ""),
            "longTermReport": str(analysis.get("long_term_report") or ""),
            "disclaimer": str(analysis.get("disclaimer") or ""),
            "missingEvidence": _string_list(analysis.get("missing_evidence")),
        },
        "fallback": {"used": True, "reason": "cold_start_generated_detail"},
    }


def _risk_level(value: Any) -> str:
    if value in {"normal", "caution", "high"}:
        return str(value)
    raise RuntimeError("backend analysis_result.risk_level must be normal, caution, or high.")


def _checklist(raw_items: Any) -> list[dict[str, Any]]:
    if not isinstance(raw_items, list):
        return []
    items = []
    for item in raw_items:
        if not isinstance(item, dict):
            continue
        items.append(
            {
                "id": str(item.get("id") or ""),
                "title": str(item.get("title") or ""),
                "status": item.get("status") or "unknown",
                "score": item.get("score") or 0,
                "reason": str(item.get("reason") or ""),
                "evidence": _string_list(item.get("evidence")),
            }
        )
    return items


def _string_list(value: Any) -> list[str]:
    if not isinstance(value, list):
        return []
    return [str(item) for item in value]
