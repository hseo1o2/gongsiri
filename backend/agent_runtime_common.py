from __future__ import annotations

from typing import Any

from backend.agent_client import AgentServiceError

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


def agent_payload_data(agent_response: dict[str, Any], *, endpoint: str) -> dict[str, Any]:
    data = agent_response.get("data")
    if isinstance(data, dict):
        return data
    raise AgentServiceError(
        "agent_malformed_response",
        "저 공시리가 공시리 응답의 structured data payload를 찾지 못했습니다.",
        status_code=502,
        evidence=agent_evidence(agent_response, endpoint=endpoint),
    )


def first_text(*values: Any) -> str | None:
    for value in values:
        if isinstance(value, str) and value.strip():
            return value
    return None


def agent_evidence(agent_response: dict[str, Any], *, endpoint: str) -> list[dict[str, Any]]:
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


def merge_checklist_explanations(
    analysis_result: dict[str, Any], explanation_items: list[dict[str, Any]]
) -> dict[str, Any]:
    explanation_by_id = {
        str(item.get("id") or ""): str(item.get("markdown") or "")
        for item in explanation_items
        if isinstance(item, dict)
    }
    checklist = (
        analysis_result.get("checklist")
        if isinstance(analysis_result.get("checklist"), list)
        else []
    )
    expected_ids = {
        str(item.get("id") or "") for item in checklist if isinstance(item, dict) and item.get("id")
    }
    actual_ids = {
        item_id for item_id, markdown in explanation_by_id.items() if item_id and markdown.strip()
    }
    if expected_ids != actual_ids:
        raise AgentServiceError(
            "agent_malformed_response",
            "저 공시리가 체크리스트 설명 항목을 완전하게 받지 못했습니다.",
            status_code=502,
            evidence=[{"source": AGENT_SOURCE, "endpoint": "/checklist-explanation"}],
        )

    merged_checklist = []
    for item in checklist:
        if not isinstance(item, dict):
            continue
        item_id = str(item.get("id") or "")
        merged_checklist.append({**item, "solar_explanation": explanation_by_id[item_id]})
    return {**analysis_result, "checklist": merged_checklist}


def expected_analysis_guard(analysis_result: dict[str, Any]) -> dict[str, Any]:
    checklist = (
        analysis_result.get("checklist")
        if isinstance(analysis_result.get("checklist"), list)
        else []
    )
    return {
        "riskScore": analysis_result.get("risk_score"),
        "riskLevel": analysis_result.get("risk_level"),
        "checklistIds": [
            str(item.get("id"))
            for item in checklist
            if isinstance(item, dict) and item.get("id") is not None
        ],
    }


def validate_analysis_guard(
    agent_response: dict[str, Any], *, analysis_result: dict[str, Any], endpoint: str
) -> None:
    data = agent_payload_data(agent_response, endpoint=endpoint)
    guard = data.get("analysisGuard") if isinstance(data.get("analysisGuard"), dict) else None
    if guard is None:
        raise AgentServiceError(
            "agent_malformed_response",
            "저 공시리가 공시리 응답의 analysisGuard를 찾지 못했습니다.",
            status_code=502,
            evidence=agent_evidence(agent_response, endpoint=endpoint),
        )

    expected = expected_analysis_guard(analysis_result)
    if (
        guard.get("riskScore") != expected["riskScore"]
        or guard.get("riskLevel") != expected["riskLevel"]
        or list(guard.get("checklistIds") or []) != expected["checklistIds"]
    ):
        raise AgentServiceError(
            "agent_malformed_response",
            "저 공시리가 공시리 응답의 deterministic risk guard 불일치를 감지했습니다.",
            status_code=502,
            evidence=agent_evidence(agent_response, endpoint=endpoint),
        )
