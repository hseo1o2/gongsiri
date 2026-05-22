from __future__ import annotations

from pathlib import Path
from typing import Any

from backend.schemas.external_api import ExternalApiEnvelope, ExternalApiError, ExternalApiEvidence

PROJECT_ROOT = Path(__file__).resolve().parents[3]
ALLOWED_RESEARCH_ROOTS = (
    PROJECT_ROOT / "assets",
    PROJECT_ROOT / "data",
    PROJECT_ROOT / "backend" / "fixtures",
)


def is_rate_limited(message: str) -> bool:
    lowered = message.lower()
    return "429" in lowered or "요청 제한" in message or "rate limit" in lowered


def is_allowed_research_path(path: Path) -> bool:
    try:
        resolved = path.resolve()
    except FileNotFoundError:
        return False
    return any(
        root.resolve() in resolved.parents or resolved == root.resolve()
        for root in ALLOWED_RESEARCH_ROOTS
    )


def failure(
    source_id: str, code: str, message: str, availability: str = "unavailable"
) -> dict[str, Any]:
    return ExternalApiEnvelope(
        ok=False,
        source_id=source_id,
        availability=availability,
        error=ExternalApiError(code=code, message=message),
        evidence=[ExternalApiEvidence(source=source_id, detail=message)],
    ).model_dump()
