from __future__ import annotations

from datetime import datetime, timezone
from typing import Any

DEFAULT_DISCLAIMER = (
    "이 리포트는 DART 공시·재무 기반 도메인 시그널만 분석하며, "
    "차트·거래량·뉴스·루머는 포함하지 않습니다. 투자 자문이 아닙니다."
)


def build_typed_envelope(
    corp_code: str,
    generated_at: str,
    pipeline_response: dict[str, Any],
) -> dict[str, Any]:
    """pipeline_response (run_pipeline_request 반환값) 를 typed envelope 로 변환.

    캐시 저장 및 GET 응답 형태:
        {
            "generated_at": "...",
            "payload": {
                "view": "report-detail",
                "report": { corpCode, corpName, analyzedAt, riskScore, riskLevel,
                            checklist, shortTermReport, longTermReport,
                            disclaimer, missingEvidence },
                "fallback": { "used": false }
            }
        }
    """
    result: dict[str, Any] = pipeline_response.get("result", {}) or {}
    analysis: dict[str, Any] = result.get("analysis_result", {}) or {}
    bundle: dict[str, Any] = result.get("normalized_data_bundle", {}) or {}
    company: dict[str, Any] = bundle.get("company", {}) or {}

    corp_code_resolved: str = company.get("corp_code") or corp_code
    corp_name_raw: str = company.get("corp_name") or ""
    stock_code: str = company.get("stock_code") or ""
    # corp_name이 stock_code와 같거나 비어있으면 corp_code 그대로
    corp_name: str = (
        corp_name_raw if corp_name_raw and corp_name_raw != stock_code else corp_code_resolved
    )

    disclaimer_raw: str = analysis.get("disclaimer") or ""
    disclaimer: str = disclaimer_raw if disclaimer_raw else DEFAULT_DISCLAIMER

    report: dict[str, Any] = {
        "corpCode": corp_code_resolved,
        "corpName": corp_name,
        "analyzedAt": generated_at,
        "riskScore": analysis.get("risk_score", 0),
        "riskLevel": analysis.get("risk_level", "normal"),
        "checklist": analysis.get("checklist", []),
        "shortTermReport": analysis.get("short_term_report", ""),
        "longTermReport": analysis.get("long_term_report") or None,
        "disclaimer": disclaimer,
        "missingEvidence": analysis.get("missing_evidence", []),
    }

    payload: dict[str, Any] = {
        "view": "report-detail",
        "report": report,
        "fallback": {"used": False},
    }

    return {
        "generated_at": generated_at,
        "payload": payload,
    }


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()
