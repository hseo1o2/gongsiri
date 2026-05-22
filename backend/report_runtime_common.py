from __future__ import annotations

import re
from datetime import UTC, datetime
from typing import Any
from uuid import uuid4

MAX_MANUAL_CHECK_BATCH_SIZE = 20
REPORT_VIEWS = {"report-list", "report-detail", "manual-check"}
CORP_CODE_PATTERN = re.compile(r"^\d{8}$")
MAX_KEYWORD_LENGTH = 80


def observed_at() -> str:
    return datetime.now(UTC).isoformat().replace("+00:00", "Z")


def report_failure(
    code: str,
    message: str,
    *,
    trace_id: str | None = None,
    contract_version: str,
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


def normalize_corp_code(value: Any, *, field_name: str) -> str | None:
    corp_code = str(value or "").strip()
    if not corp_code:
        return None
    if not CORP_CODE_PATTERN.fullmatch(corp_code):
        raise ValueError(f"{field_name}는 8자리 숫자 corpCode여야 합니다.")
    return corp_code


def normalize_keyword(value: Any, *, field_name: str) -> str | None:
    keyword = str(value or "").strip()
    if not keyword:
        return None
    if len(keyword) > MAX_KEYWORD_LENGTH:
        raise ValueError(f"{field_name}는 {MAX_KEYWORD_LENGTH}자 이하여야 합니다.")
    if any(char in keyword for char in ("/", "\\")) or any(ord(char) < 32 for char in keyword):
        raise ValueError(f"{field_name}에 경로 또는 제어 문자를 사용할 수 없습니다.")
    return keyword


def corp_codes(payload: dict[str, Any]) -> list[str]:
    raw_codes = payload.get("corpCodes") or []
    if not isinstance(raw_codes, list):
        raise ValueError("corpCodes는 배열이어야 합니다.")
    return [
        corp_code
        for code in raw_codes
        if (corp_code := normalize_corp_code(code, field_name="corpCodes[]"))
    ]


def truthy(value: Any) -> bool:
    if isinstance(value, bool):
        return value
    if isinstance(value, str):
        return value.strip().lower() in {"1", "true", "yes", "on"}
    if isinstance(value, (int, float)):
        return value != 0
    return False


def risk_level(value: Any) -> str:
    if value in {"normal", "caution", "high"}:
        return str(value)
    raise RuntimeError("backend analysis_result.risk_level must be normal, caution, or high.")


def string_list(value: Any) -> list[str]:
    if not isinstance(value, list):
        return []
    return [str(item) for item in value]


def evidence_refs(value: Any) -> list[dict[str, Any]]:
    if not isinstance(value, list):
        return []
    refs: list[dict[str, Any]] = []
    for item in value:
        if not isinstance(item, dict):
            continue
        refs.append(
            {
                "label": str(item.get("label") or ""),
                "source": str(item.get("source") or "deterministic_backend"),
                "observedAt": item.get("observed_at"),
            }
        )
    return refs


def checklist_view(raw_items: Any) -> list[dict[str, Any]]:
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
                "evidence": string_list(item.get("evidence")),
                "evidenceRefs": evidence_refs(item.get("evidence_refs")),
                "source": str(item.get("source") or "deterministic_backend"),
                "observedAt": item.get("observed_at"),
                "explanationMarkdown": str(item.get("solar_explanation") or ""),
            }
        )
    return items


def checklist_storage(raw_items: Any) -> list[dict[str, Any]]:
    if not isinstance(raw_items, list):
        return []
    return [dict(item) for item in raw_items if isinstance(item, dict)]


def latest_value(rows: list[Any], *, key: str) -> str | None:
    values = [str(item.get(key)) for item in rows if isinstance(item, dict) and item.get(key)]
    return max(values) if values else None


def source_timestamps(bundle: dict[str, Any]) -> dict[str, str | None]:
    disclosures = bundle.get("disclosures") if isinstance(bundle.get("disclosures"), list) else []
    news_docs = bundle.get("news_docs") if isinstance(bundle.get("news_docs"), list) else []
    price_volume = (
        bundle.get("price_volume") if isinstance(bundle.get("price_volume"), dict) else {}
    )
    price_daily = price_volume.get("daily") if isinstance(price_volume.get("daily"), list) else []
    return {
        "latestDisclosureDate": latest_value(disclosures, key="rcept_dt"),
        "latestNewsDate": latest_value(news_docs, key="date"),
        "latestPriceDate": latest_value(price_daily, key="date"),
    }


def detail_view_from_report_row(row: dict[str, Any], *, fallback: dict[str, Any]) -> dict[str, Any]:
    return {
        "view": "report-detail",
        "report": {
            "corpCode": str(row.get("corp_code") or ""),
            "corpName": str(row.get("corp_name") or row.get("corp_code") or ""),
            "analyzedAt": str(row.get("generated_at") or observed_at()),
            "riskLevel": risk_level(row.get("risk_level")),
            "riskScore": int(row.get("risk_score") or 0),
            "checklist": checklist_view(row.get("checklist")),
            "shortTermReport": str(row.get("short_term_report") or ""),
            "longTermReport": str(row.get("long_term_report") or ""),
            "disclaimer": str(row.get("disclaimer") or ""),
            "missingEvidence": string_list(row.get("missing_evidence")),
        },
        "fallback": fallback,
    }


def summary_view(row: dict[str, Any]) -> dict[str, Any]:
    return {
        "corpCode": str(row.get("corp_code") or ""),
        "corpName": str(row.get("corp_name") or row.get("corp_code") or ""),
        "analyzedAt": str(row.get("generated_at") or observed_at()),
        "riskLevel": risk_level(row.get("risk_level")),
        "riskScore": int(row.get("risk_score") or 0),
    }
