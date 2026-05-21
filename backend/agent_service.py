from __future__ import annotations

from typing import Any

from backend.agent_client import AgentServiceClient, AgentServiceError, resolve_agent_service_url

AGENT_SOURCE = "pi_agent_http"


def agent_failure_envelope(
    exc: AgentServiceError,
    *,
    trace_id: str,
    contract_version: str,
    observed_at: str,
    source: str = "user",
) -> dict[str, Any]:
    return {
        "ok": False,
        "triggerSource": source,
        "traceId": trace_id,
        "contractVersion": contract_version,
        "observedAt": observed_at,
        "error": {"code": exc.code, "message": exc.message},
        "evidence": exc.evidence,
    }


def _agent_payload_data(agent_response: dict[str, Any]) -> dict[str, Any]:
    data = agent_response.get("data")
    if isinstance(data, dict):
        return data
    result = agent_response.get("result")
    if isinstance(result, dict):
        return result
    return agent_response


def _first_text(*values: Any) -> str | None:
    for value in values:
        if isinstance(value, str) and value.strip():
            return value
    return None


def _extract_report_fields(agent_response: dict[str, Any]) -> dict[str, str]:
    data = _agent_payload_data(agent_response)
    report = data.get("report") if isinstance(data.get("report"), dict) else {}
    analysis = data.get("analysisResult") or data.get("analysis_result")
    if not isinstance(analysis, dict):
        analysis = {}

    fields: dict[str, str] = {}
    short_term = _first_text(
        analysis.get("short_term_report"),
        report.get("shortTermReport"),
        report.get("short_term_report"),
        data.get("shortTermReport"),
        data.get("short_term_report"),
        data.get("reportText"),
        data.get("text"),
    )
    long_term = _first_text(
        analysis.get("long_term_report"),
        report.get("longTermReport"),
        report.get("long_term_report"),
        data.get("longTermReport"),
        data.get("long_term_report"),
    )
    disclaimer = _first_text(
        analysis.get("disclaimer"),
        report.get("disclaimer"),
        data.get("disclaimer"),
    )

    if short_term is not None:
        fields["short_term_report"] = short_term
    if long_term is not None:
        fields["long_term_report"] = long_term
    if disclaimer is not None:
        fields["disclaimer"] = disclaimer
    return fields


def _agent_evidence(agent_response: dict[str, Any], *, endpoint: str) -> list[dict[str, Any]]:
    evidence = (
        agent_response.get("evidence") if isinstance(agent_response.get("evidence"), list) else []
    )
    normalized = [item for item in evidence if isinstance(item, dict)]
    normalized.append(
        {
            "source": AGENT_SOURCE,
            "endpoint": endpoint,
            "agentSource": agent_response.get("source") or AGENT_SOURCE,
            "traceId": agent_response.get("traceId"),
            "contractVersion": agent_response.get("contractVersion"),
        }
    )
    return normalized


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

    agent_client = client or AgentServiceClient()
    agent_response = agent_client.generate_report(
        {
            "traceId": pipeline_response.get("traceId"),
            "contractVersion": pipeline_response.get("contractVersion"),
            "source": pipeline_response.get("triggerSource"),
            "normalizedDataBundle": result.get("normalized_data_bundle"),
            "analysisResult": result.get("analysis_result"),
            "preparation": result.get("preparation"),
        }
    )

    merged_result = dict(result)
    analysis_result = dict(merged_result.get("analysis_result") or {})
    analysis_result.update(_extract_report_fields(agent_response))
    merged_result["analysis_result"] = analysis_result
    merged_result["agent"] = {
        "source": AGENT_SOURCE,
        "serviceUrl": resolve_agent_service_url(),
        "traceId": agent_response.get("traceId"),
        "contractVersion": agent_response.get("contractVersion"),
    }

    return {
        **pipeline_response,
        "result": merged_result,
        "evidence": list(pipeline_response.get("evidence") or [])
        + _agent_evidence(agent_response, endpoint="/report"),
    }


def answer_qa_with_agent(
    *,
    question: str,
    bundle: Any,
    analysis_result: Any,
    trace_id: str,
    contract_version: str,
    client: AgentServiceClient | None = None,
) -> dict[str, Any]:
    agent_client = client or AgentServiceClient()
    bundle_payload = bundle.model_dump() if hasattr(bundle, "model_dump") else bundle
    analysis_payload = (
        analysis_result.model_dump() if hasattr(analysis_result, "model_dump") else analysis_result
    )
    agent_response = agent_client.answer_qa(
        {
            "traceId": trace_id,
            "contractVersion": contract_version,
            "question": question,
            "normalizedDataBundle": bundle_payload,
            "analysisResult": analysis_payload,
        }
    )
    data = _agent_payload_data(agent_response)
    answer = _first_text(data.get("answer"), data.get("text"), agent_response.get("answer"))
    if answer is None:
        raise AgentServiceError(
            "agent_malformed_response",
            "저 공시리가 Pi agent service QA 응답에서 답변 본문을 찾지 못했습니다.",
            status_code=502,
            evidence=_agent_evidence(agent_response, endpoint="/qa"),
        )

    return {
        "answer": answer,
        "source": AGENT_SOURCE,
        "evidence": _agent_evidence(agent_response, endpoint="/qa"),
    }
