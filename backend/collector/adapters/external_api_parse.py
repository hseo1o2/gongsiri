from __future__ import annotations

from pathlib import Path
from typing import Any

from backend.collector.adapters.external_api_common import failure, is_allowed_research_path, is_rate_limited
from backend.collector.document_parse import parse_local_report_file
from backend.schemas.external_api import ExternalResearchReport


def parse_research_preview(file_path: str) -> dict[str, Any]:
    normalized = file_path.strip()
    if not normalized:
        return failure("document_parse_research", "invalid_request", "file_path가 비어 있습니다.")
    path = Path(normalized)
    if not path.exists():
        return failure(
            "document_parse_research",
            "invalid_request",
            f"파일을 찾을 수 없습니다: {normalized}",
        )
    if not is_allowed_research_path(path):
        return failure(
            "document_parse_research",
            "invalid_request",
            "허용된 연구 자료 경로에서만 parse preview를 실행할 수 있습니다.",
        )
    try:
        parsed = parse_local_report_file(str(path))
        lines = [line.strip() for line in parsed.parsed_text.splitlines() if line.strip()]
        report = ExternalResearchReport(
            source_url=None,
            parsed_sections=lines[:8],
            extracted_tables=[line for line in lines if "|" in line][:5],
            key_points=lines[:5],
        )
        return {
            "ok": True,
            "source_id": "document_parse_research",
            "availability": "available",
            "report": report.model_dump(),
            "evidence": [{"source": "document_parse_research", "detail": path.name}],
        }
    except ValueError as exc:
        message = str(exc)
        code = "missing_env" if "UPSTAGE_API_KEY" in message else "invalid_request"
        return failure("document_parse_research", code, message)
    except Exception as exc:
        message = str(exc)
        code = "rate_limited" if is_rate_limited(message) else "source_unavailable"
        return failure("document_parse_research", code, message)
