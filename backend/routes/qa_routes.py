from __future__ import annotations

from typing import Any
from uuid import uuid4

from fastapi import APIRouter, Request
from fastapi.responses import JSONResponse
from starlette.concurrency import run_in_threadpool

from backend.agent_client import AgentServiceError, stdout_trace
from backend.agent_service import agent_failure_envelope, answer_qa_with_agent
from backend.analyzer.pipeline import CONTRACT_VERSION
from backend.analyzer.qa import analyze_bundle
from backend.auth.dev_session import (
    build_dev_user_scoped_row,
    require_dev_auth_mode,
    resolve_dev_user_id,
)
from backend.collector.runtime_normalize import build_runtime_normalized_bundle
from backend.http_contracts import read_json_object, typed_pipeline_failure, utc_now
from backend.report_views import normalize_corp_code, normalize_keyword
from backend.storage.connection import get_repository_provider
from backend.storage.schema import SCHEMA_VERSION

router = APIRouter(tags=["qa"])


def _payload_value(payload: object, key: str, fallback: str) -> str:
    if isinstance(payload, dict):
        return str(payload.get(key) or fallback)
    return fallback


def _resolve_qa_request(payload: dict[str, Any]) -> tuple[str, str | None, str | None]:
    question = str(payload.get("question") or "").strip()
    corp_code = normalize_corp_code(
        payload.get("corpCode") or payload.get("corp_code"), field_name="corpCode"
    )
    keyword = normalize_keyword(payload.get("keyword"), field_name="keyword")
    if not question:
        raise ValueError("question은 비어 있을 수 없습니다.")
    if not corp_code and not keyword:
        raise ValueError("corpCode 또는 keyword 중 하나는 반드시 필요합니다.")
    return question, corp_code, keyword


def _save_qa_history_row(*, bundle: Any, question: str, answer: dict[str, Any]) -> dict[str, Any]:
    bundle_payload = bundle.model_dump() if hasattr(bundle, "model_dump") else bundle
    company = (
        bundle_payload.get("company")
        if isinstance(bundle_payload, dict) and isinstance(bundle_payload.get("company"), dict)
        else {}
    )
    corp_code = str(company.get("corp_code") or "")
    corp_name = str(company.get("corp_name") or corp_code)
    row = build_dev_user_scoped_row(
        {
            "id": f"qa-{corp_code}-{uuid4()}",
            "corp_code": corp_code,
            "corp_name": corp_name,
            "question": question,
            "answer": str(answer.get("answer") or ""),
            "evidence": answer.get("evidence") if isinstance(answer.get("evidence"), list) else [],
            "asked_at": utc_now(),
            "source_version": SCHEMA_VERSION,
        }
    )
    return get_repository_provider().qa_history.save_answer(row)


@router.post("/qa")
async def qa_route(request: Request):
    failure = require_dev_auth_mode()
    if failure is not None:
        return failure
    try:
        payload, _empty_body = await read_json_object(request)
        question, corp_code, keyword = _resolve_qa_request(payload)
        stdout_trace("qa", f"view=qa corp={corp_code or keyword or '-'} mode=qa cache=miss")
        user_id = resolve_dev_user_id()
        bundle = await run_in_threadpool(
            build_runtime_normalized_bundle,
            keyword=keyword,
            corp_code=corp_code,
        )
        analysis_result = await run_in_threadpool(analyze_bundle, bundle)

        bundle_payload = bundle.model_dump() if hasattr(bundle, "model_dump") else bundle
        company = bundle_payload.get("company") if isinstance(bundle_payload, dict) else {}
        effective_corp_code = str((company or {}).get("corp_code") or "")

        conversation_key: str | None = None
        prior_turns: list[dict] = []
        if effective_corp_code:
            raw_turns = await run_in_threadpool(
                get_repository_provider().qa_history.list_recent_turns,
                user_id=user_id,
                corp_code=effective_corp_code,
                limit=2,
            )
            for row in raw_turns:
                prior_turns.append({"role": "user", "content": str(row.get("question") or "")})
                prior_turns.append({"role": "assistant", "content": str(row.get("answer") or "")})
            conversation_key = f"{user_id}::{effective_corp_code}"

        answer = await run_in_threadpool(
            answer_qa_with_agent,
            question=question,
            bundle=bundle,
            analysis_result=analysis_result,
            trace_id=str(payload.get("traceId") or uuid4()),
            contract_version=str(payload.get("contractVersion") or CONTRACT_VERSION),
            conversation_key=conversation_key,
            prior_turns=prior_turns or None,
        )
        await run_in_threadpool(
            _save_qa_history_row,
            bundle=bundle,
            question=question,
            answer=answer,
        )
        return answer
    except ValueError as exc:
        source = _payload_value(locals().get("payload"), "source", "user")
        return JSONResponse(
            content=typed_pipeline_failure("invalid_request", str(exc), source=source),
            status_code=400,
        )
    except AgentServiceError as exc:
        payload = locals().get("payload")
        return JSONResponse(
            content=agent_failure_envelope(
                exc,
                trace_id=_payload_value(payload, "traceId", str(uuid4())),
                contract_version=CONTRACT_VERSION,
                observed_at=utc_now(),
                source=_payload_value(payload, "source", "user"),
            ),
            status_code=exc.status_code,
        )


@router.get("/api/v1/qa-history")
def qa_history_route(corp_code: str | None = None):
    failure = require_dev_auth_mode()
    if failure is not None:
        return failure
    try:
        normalized = normalize_corp_code(corp_code, field_name="corp_code") if corp_code else None
    except ValueError as exc:
        return JSONResponse(
            content=typed_pipeline_failure("invalid_request", str(exc), source="user"),
            status_code=400,
        )
    items = get_repository_provider().qa_history.list_for_user(
        user_id=resolve_dev_user_id(), corp_code=normalized
    )
    return {
        "ok": True,
        "items": [
            {
                "id": str(item["id"]),
                "corpCode": str(item["corp_code"]),
                "corpName": str(item.get("corp_name") or item["corp_code"]),
                "question": str(item["question"]),
                "answer": str(item["answer"]),
                "evidence": item.get("evidence") if isinstance(item.get("evidence"), list) else [],
                "askedAt": str(item["asked_at"]),
            }
            for item in items
        ],
    }
