from __future__ import annotations

from datetime import UTC, datetime
from typing import Any, Callable, Mapping
from uuid import uuid4

from backend.analyzer.pipeline import CONTRACT_VERSION
from backend.collector.company_resolver import resolve_company_read_only
from backend.collector.dart import fetch_disclosures
from backend.schemas.bundle import CompanyInfo, DisclosureItem

DEFAULT_BGN_DE = "20240101"
DEFAULT_END_DE = "20241231"
DEFAULT_PAGE_COUNT = 20


class InvalidRequestError(ValueError):
    code = "invalid_request"


class CorpCodeUnresolvedError(RuntimeError):
    code = "corp_code_unresolved"


Resolver = Callable[[str], CompanyInfo]
Fetcher = Callable[[str, str, str, int], list[DisclosureItem]]


def _observed_at(now: datetime | None = None) -> str:
    current = now or datetime.now(UTC)
    return current.isoformat().replace("+00:00", "Z")


def _failure(code: str, message: str, trace_id: str, observed_at: str) -> dict[str, Any]:
    return {
        "ok": False,
        "traceId": trace_id,
        "contractVersion": CONTRACT_VERSION,
        "observedAt": observed_at,
        "error": {
            "code": code,
            "message": message,
        },
        "evidence": [],
    }


def _map_exception(exc: Exception) -> tuple[str, str]:
    code = getattr(exc, "code", None)
    if code:
        return code, str(exc)

    message = str(exc)

    if "DART_API_KEY" in message:
        return "missing_env", message

    if "종목 검색 실패" in message or "corp code를 확인할 수 없습니다" in message:
        return "corp_code_unresolved", message

    if "OpenDART API error" in message:
        return "dart_api_error", message

    return "bridge_process_failed", message


def _resolve_corp_code(
    request: Mapping[str, Any],
    resolver: Resolver,
) -> tuple[str, CompanyInfo | None, dict[str, Any]]:
    corp_code = request.get("corpCode")
    if corp_code:
        return str(corp_code), None, {"source": "corp_code_input", "corpCode": str(corp_code)}

    keyword = str(request.get("keyword") or "").strip()
    if not keyword:
        raise InvalidRequestError("keyword 또는 corpCode 중 하나는 반드시 필요합니다.")

    company = resolver(keyword)
    if not company.corp_code:
        raise CorpCodeUnresolvedError(f"corp code를 확인할 수 없습니다: {keyword}")

    return (
        company.corp_code,
        company,
        {
            "source": "keyword_resolution",
            "keyword": keyword,
            "corpCode": company.corp_code,
            "corpName": company.corp_name,
        },
    )


def run_fetch_disclosures_request(
    request: Mapping[str, Any],
    *,
    resolver: Resolver = resolve_company_read_only,
    fetcher: Fetcher = fetch_disclosures,
    trace_id: str | None = None,
    now: datetime | None = None,
) -> dict[str, Any]:
    current_trace_id = trace_id or str(uuid4())
    observed_at = _observed_at(now)

    try:
        corp_code, company, resolution_evidence = _resolve_corp_code(request, resolver)
        bgn_de = str(request.get("bgnDe") or DEFAULT_BGN_DE)
        end_de = str(request.get("endDe") or DEFAULT_END_DE)
        page_count = int(request.get("pageCount") or DEFAULT_PAGE_COUNT)

        disclosures = fetcher(corp_code, bgn_de, end_de, page_count)

        return {
            "ok": True,
            "traceId": current_trace_id,
            "contractVersion": CONTRACT_VERSION,
            "observedAt": observed_at,
            "data": {
                "corpCode": corp_code,
                "company": company.model_dump() if company else None,
                "disclosures": [item.model_dump() for item in disclosures],
            },
            "evidence": [
                resolution_evidence,
                {
                    "source": "dart_fetch",
                    "disclosureCount": len(disclosures),
                    "bgnDe": bgn_de,
                    "endDe": end_de,
                    "pageCount": page_count,
                },
            ],
        }
    except Exception as exc:
        code, message = _map_exception(exc)
        return _failure(code, message, current_trace_id, observed_at)
