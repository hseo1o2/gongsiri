from __future__ import annotations

from typing import Any
from uuid import uuid4

from backend.agent_service import attach_agent_report
from backend.analyzer.pipeline import CONTRACT_VERSION, run_pipeline_request
from backend.auth.dev_session import resolve_dev_user_id
from backend.report_runtime_common import (
    MAX_MANUAL_CHECK_BATCH_SIZE,
    checklist_storage,
    corp_codes,
    detail_view_from_report_row,
    normalize_corp_code,
    normalize_keyword,
    risk_level,
    source_timestamps,
    summary_view,
    truthy,
)
from backend.storage.connection import get_repository_provider
from backend.storage.schema import SCHEMA_VERSION


def build_report_list_response(payload: dict[str, Any]) -> dict[str, Any]:
    filtered_corp_codes = set(corp_codes(payload))
    rows = get_repository_provider().reports.list_latest_for_user(resolve_dev_user_id())
    if filtered_corp_codes:
        rows = [row for row in rows if row.get("corp_code") in filtered_corp_codes]

    if not rows:
        return {
            "view": "report-list",
            "reports": [],
            "fallback": {"used": True, "reason": "cold_start_no_cached_reports"},
        }

    return {
        "view": "report-list",
        "reports": [summary_view(row) for row in rows],
        "fallback": {"used": False},
    }


def build_manual_check_response(payload: dict[str, Any]) -> dict[str, Any]:
    requested_corp_codes = corp_codes(payload)
    if len(requested_corp_codes) > MAX_MANUAL_CHECK_BATCH_SIZE:
        raise OverflowError(
            f"manual-check는 최대 {MAX_MANUAL_CHECK_BATCH_SIZE}개 종목까지 지원합니다."
        )
    return {
        "view": "manual-check",
        "acceptedCorpCodes": requested_corp_codes,
        "maxBatchSize": MAX_MANUAL_CHECK_BATCH_SIZE,
        "fallback": {"used": True, "reason": "read_only_manual_check"},
    }


def build_report_detail_response(payload: dict[str, Any]) -> dict[str, Any]:
    corp_code = normalize_corp_code(payload.get("corpCode"), field_name="corpCode")
    keyword = normalize_keyword(payload.get("keyword"), field_name="keyword")
    if not corp_code and not keyword:
        raise ValueError("report-detail은 corpCode 또는 keyword 중 하나가 필요합니다.")

    force_refresh = truthy(payload.get("forceRefresh") or payload.get("reanalyze"))
    provider = get_repository_provider()
    if corp_code and not force_refresh:
        cached = provider.reports.get_latest_detail(
            user_id=resolve_dev_user_id(), corp_code=corp_code
        )
        if cached is not None:
            return detail_view_from_report_row(cached, fallback={"used": False})

    pipeline_request = pipeline_request_from_payload(
        payload, corp_code=corp_code or None, keyword=keyword or None
    )
    pipeline_response = run_pipeline_request(
        pipeline_request, trace_id=pipeline_request.get("traceId")
    )
    if not pipeline_response.get("ok"):
        return pipeline_response

    agent_response = attach_agent_report(pipeline_response)
    saved = save_generated_report(provider, agent_response, request_context=pipeline_request)
    fallback = {"used": not force_refresh}
    if not force_refresh:
        fallback["reason"] = "cold_start_generated_detail"
    return detail_view_from_report_row(saved, fallback=fallback)


def save_generated_report(
    provider: Any,
    agent_response: dict[str, Any],
    *,
    request_context: dict[str, Any],
) -> dict[str, Any]:
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
    corp_code = str(company.get("corp_code") or request_context.get("corpCode") or "")
    corp_name = str(company.get("corp_name") or request_context.get("keyword") or corp_code)
    generated_at = str(agent_response.get("observedAt") or "")
    trace_id = str(agent_response.get("traceId") or uuid4())

    row = {
        "id": f"report-{corp_code}-{trace_id}",
        "user_id": resolve_dev_user_id(),
        "corp_code": corp_code,
        "corp_name": corp_name,
        "risk_level": risk_level(analysis.get("risk_level")),
        "risk_score": int(analysis.get("risk_score") or 0),
        "checklist": checklist_storage(analysis.get("checklist")),
        "short_term_report": str(analysis.get("short_term_report") or ""),
        "long_term_report": str(analysis.get("long_term_report") or ""),
        "disclaimer": str(analysis.get("disclaimer") or ""),
        "missing_evidence": analysis.get("missing_evidence") or [],
        "request_context": request_context,
        "source_timestamps": source_timestamps(bundle),
        "strict_pi_sdk": 1,
        "generated_at": generated_at,
        "source_version": SCHEMA_VERSION,
    }
    return provider.reports.save_detail(row)


def pipeline_request_from_payload(
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
