from __future__ import annotations

import os
from typing import Any
from uuid import uuid4

from backend.agent_client import AgentServiceClient
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
    observed_at,
    risk_level,
    source_timestamps,
    summary_view,
    truthy,
)
from backend.storage.connection import get_repository_provider
from backend.storage.schema import SCHEMA_VERSION


def build_report_list_response(payload: dict[str, Any]) -> dict[str, Any]:
    filtered_corp_codes = set(corp_codes(payload))
    user_id = resolve_dev_user_id()
    provider = get_repository_provider()

    report_rows = provider.reports.list_latest_for_user(user_id)
    if filtered_corp_codes:
        report_rows = [row for row in report_rows if row.get("corp_code") in filtered_corp_codes]

    # 워치리스트 종목을 함께 조회해서 리포트가 없는 종목도 목록에 포함
    watchlist_rows = provider.watchlist.list_for_user(user_id)
    report_corp_codes = {str(row["corp_code"]) for row in report_rows}

    reports = [summary_view(row) for row in report_rows]

    for wl_row in watchlist_rows:
        corp_code = str(wl_row.get("corp_code") or "")
        if not corp_code:
            continue
        if filtered_corp_codes and corp_code not in filtered_corp_codes:
            continue
        if corp_code in report_corp_codes:
            continue
        # 리포트가 없는 워치리스트 종목 — hasReport=False 로 표시
        reports.append(
            {
                "corpCode": corp_code,
                "corpName": str(wl_row.get("corp_name") or corp_code),
                "analyzedAt": "",
                "riskLevel": "normal",
                "riskScore": 0,
                "hasReport": False,
            }
        )

    if not reports:
        return {
            "view": "report-list",
            "reports": [],
            "fallback": {"used": True, "reason": "cold_start_no_cached_reports"},
        }

    return {
        "view": "report-list",
        "reports": reports,
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

    # agent tool-loop path (cache miss 후에만 실행 — binding #5)
    if os.getenv("GONGSIRI_AGENT_REPORT_MODE", "").lower() in {"true", "1", "yes"} and corp_code:
        agent_resp = AgentServiceClient(timeout=60.0).generate_report(
            {
                "corpCode": corp_code,
                "traceId": str(payload.get("traceId") or uuid4()),
                "contractVersion": str(payload.get("contractVersion") or CONTRACT_VERSION),
            }
        )
        saved = save_agent_path_report(
            provider=provider,
            corp_code=corp_code,
            corp_name=str(payload.get("corpName") or corp_code),
            agent_response=agent_resp,
            request_context={"corpCode": corp_code, "source": "agent_tool_loop"},
        )
        return detail_view_from_report_row(
            saved, fallback={"used": False, "reason": "agent_tool_loop"}
        )

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


def save_agent_path_report(
    provider: Any,
    *,
    corp_code: str,
    corp_name: str,
    agent_response: dict[str, Any],
    request_context: dict[str, Any],
) -> dict[str, Any]:
    """agent tool-loop `/report` 응답을 DB row로 변환해 저장한다.

    agent_response shape (보수적 파싱):
      {ok, data: {report: {shortTermMarkdown, longTermMarkdown, disclaimerMarkdown},
                  analysisGuard: {riskScore, riskLevel, checklistIds}},
       evidence[], warnings[], traceId, contractVersion}
    """
    data = agent_response.get("data") if isinstance(agent_response.get("data"), dict) else {}
    report = data.get("report") if isinstance(data.get("report"), dict) else {}
    guard = data.get("analysisGuard") if isinstance(data.get("analysisGuard"), dict) else {}
    warnings = (
        agent_response.get("warnings") if isinstance(agent_response.get("warnings"), list) else []
    )

    raw_risk_level = guard.get("riskLevel") or "normal"
    try:
        safe_risk_level = risk_level(raw_risk_level)
    except RuntimeError:
        safe_risk_level = "normal"

    trace_id = str(agent_response.get("traceId") or uuid4())
    row = {
        "id": f"report-{corp_code}-{trace_id}",
        "user_id": resolve_dev_user_id(),
        "corp_code": corp_code,
        "corp_name": corp_name,
        "risk_level": safe_risk_level,
        "risk_score": int(guard.get("riskScore") or 0),
        "checklist": checklist_storage(guard.get("checklist") or []),
        "short_term_report": str(
            report.get("shortTermMarkdown") or report.get("shortTermReport") or ""
        ),
        "long_term_report": str(
            report.get("longTermMarkdown") or report.get("longTermReport") or ""
        ),
        "disclaimer": str(report.get("disclaimerMarkdown") or report.get("disclaimer") or ""),
        "missing_evidence": [str(w) for w in warnings],
        "request_context": request_context,
        "source_timestamps": {},
        "strict_pi_sdk": 1,
        "generated_at": observed_at(),
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
