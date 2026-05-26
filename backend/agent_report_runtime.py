from __future__ import annotations

from typing import Any

from backend.agent_client import AgentServiceClient, AgentServiceError, resolve_agent_service_url
from backend.agent_qa_runtime import explain_checklist_with_agent
from backend.agent_runtime_common import (
    AGENT_SOURCE,
    agent_evidence,
    agent_payload_data,
    first_text,
    merge_checklist_explanations,
    validate_analysis_guard,
)
from backend.analyzer.pipeline import CONTRACT_VERSION


def extract_report_fields(agent_response: dict[str, Any]) -> dict[str, str]:
    data = agent_payload_data(agent_response, endpoint="/report")
    report = data.get("report") if isinstance(data.get("report"), dict) else {}

    fields: dict[str, str] = {}
    short_term = first_text(report.get("shortTermMarkdown"))
    long_term = first_text(report.get("longTermMarkdown"))
    disclaimer = first_text(report.get("disclaimerMarkdown"))

    if short_term is not None:
        fields["short_term_report"] = short_term
    if long_term is not None:
        fields["long_term_report"] = long_term
    if disclaimer is not None:
        fields["disclaimer"] = disclaimer
    return fields


def attach_agent_report(
    pipeline_response: dict[str, Any],
    *,
    client: AgentServiceClient | None = None,
) -> dict[str, Any]:
    if not pipeline_response.get("ok"):
        return pipeline_response

    result = pipeline_response.get("result")
    if not isinstance(result, dict):
        return pipeline_response

    analysis_result_payload = dict(result.get("analysis_result") or {})
    agent_client = client or AgentServiceClient()
    agent_response = agent_client.generate_report(
        {
            "mode": "report",
            "traceId": pipeline_response.get("traceId"),
            "contractVersion": pipeline_response.get("contractVersion"),
            "source": pipeline_response.get("triggerSource"),
            "normalizedDataBundle": result.get("normalized_data_bundle"),
            "analysisResult": analysis_result_payload,
            "preparation": result.get("preparation"),
        }
    )
    validate_analysis_guard(
        agent_response,
        analysis_result=analysis_result_payload,
        endpoint="/report",
    )

    report_fields = extract_report_fields(agent_response)
    if not report_fields.get("short_term_report"):
        raise AgentServiceError(
            "agent_malformed_response",
            "저 공시리가 공시리 리포트 응답에서 본문을 찾지 못했습니다.",
            status_code=502,
            evidence=agent_evidence(agent_response, endpoint="/report"),
        )

    merged_result = dict(result)
    analysis_result = dict(analysis_result_payload)
    analysis_result.update(report_fields)
    checklist_explanation: dict[str, Any] = {"evidence": []}
    if isinstance(analysis_result.get("checklist"), list) and analysis_result.get("checklist"):
        checklist_explanation = explain_checklist_with_agent(
            bundle=result.get("normalized_data_bundle"),
            analysis_result=analysis_result,
            trace_id=str(pipeline_response.get("traceId") or ""),
            contract_version=str(pipeline_response.get("contractVersion") or CONTRACT_VERSION),
            client=agent_client,
        )
        analysis_result = merge_checklist_explanations(
            analysis_result, checklist_explanation.get("items") or []
        )
    merged_result["analysis_result"] = analysis_result
    merged_result["agent"] = {
        "source": AGENT_SOURCE,
        "serviceUrl": resolve_agent_service_url(),
        "traceId": agent_response.get("traceId"),
        "contractVersion": agent_response.get("contractVersion"),
        "mode": agent_response.get("mode") or "report",
        "checklistMode": "checklist_explanation",
    }

    return {
        **pipeline_response,
        "result": merged_result,
        "evidence": list(pipeline_response.get("evidence") or [])
        + agent_evidence(agent_response, endpoint="/report")
        + list(checklist_explanation.get("evidence") or []),
    }
