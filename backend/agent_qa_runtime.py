from __future__ import annotations

from typing import Any

from backend.agent_client import AgentServiceClient, AgentServiceError
from backend.agent_runtime_common import (
    agent_evidence,
    agent_payload_data,
    first_text,
    validate_analysis_guard,
)


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
    analysis_payload_dict = dict(analysis_payload or {})
    agent_response = agent_client.answer_qa(
        {
            "mode": "qa",
            "traceId": trace_id,
            "contractVersion": contract_version,
            "question": question,
            "normalizedDataBundle": bundle_payload,
            "analysisResult": analysis_payload,
        }
    )
    validate_analysis_guard(
        agent_response,
        analysis_result=analysis_payload_dict,
        endpoint="/qa",
    )
    data = agent_payload_data(agent_response, endpoint="/qa")
    qa_payload = data.get("qa") if isinstance(data.get("qa"), dict) else {}
    answer = first_text(qa_payload.get("answerMarkdown"))
    if answer is None:
        raise AgentServiceError(
            "agent_malformed_response",
            "저 공시리가 공시리 Q&A 응답에서 답변 본문을 찾지 못했습니다.",
            status_code=502,
            evidence=agent_evidence(agent_response, endpoint="/qa"),
        )

    return {
        "answer": answer,
        "source": "pi_agent_http",
        "evidence": agent_evidence(agent_response, endpoint="/qa"),
    }


def explain_checklist_with_agent(
    *,
    bundle: Any,
    analysis_result: Any,
    trace_id: str,
    contract_version: str,
    checklist_ids: list[str] | None = None,
    client: AgentServiceClient | None = None,
) -> dict[str, Any]:
    agent_client = client or AgentServiceClient()
    bundle_payload = bundle.model_dump() if hasattr(bundle, "model_dump") else bundle
    analysis_payload = (
        analysis_result.model_dump() if hasattr(analysis_result, "model_dump") else analysis_result
    )
    analysis_payload_dict = dict(analysis_payload or {})
    agent_response = agent_client.explain_checklist(
        {
            "mode": "checklist_explanation",
            "traceId": trace_id,
            "contractVersion": contract_version,
            "normalizedDataBundle": bundle_payload,
            "analysisResult": analysis_payload,
            "checklistIds": checklist_ids or [],
        }
    )
    validate_analysis_guard(
        agent_response,
        analysis_result=analysis_payload_dict,
        endpoint="/checklist-explanation",
    )
    data = agent_payload_data(agent_response, endpoint="/checklist-explanation")
    checklist_payload = (
        data.get("checklistExplanation")
        if isinstance(data.get("checklistExplanation"), dict)
        else {}
    )
    items = (
        checklist_payload.get("items") if isinstance(checklist_payload.get("items"), list) else []
    )
    if not items:
        raise AgentServiceError(
            "agent_malformed_response",
            "저 공시리가 공시리 체크리스트 설명 응답에서 항목 설명을 찾지 못했습니다.",
            status_code=502,
            evidence=agent_evidence(agent_response, endpoint="/checklist-explanation"),
        )

    normalized_items = []
    for item in items:
        if not isinstance(item, dict):
            continue
        normalized_items.append(
            {
                "id": str(item.get("id") or ""),
                "title": str(item.get("title") or ""),
                "markdown": str(item.get("markdown") or ""),
            }
        )

    return {
        "markdown": str(agent_response.get("markdown") or agent_response.get("text") or ""),
        "items": normalized_items,
        "source": "pi_agent_http",
        "evidence": agent_evidence(agent_response, endpoint="/checklist-explanation"),
    }
