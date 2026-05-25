from __future__ import annotations

from backend.analyzer.checklist import build_checklist, calculate_risk_score, classify_risk_level
from backend.schemas.analysis import AnalysisResult
from backend.schemas.bundle import NormalizedDataBundle


def run_step1(bundle: NormalizedDataBundle) -> AnalysisResult:
    checklist = build_checklist(bundle)
    risk_score = calculate_risk_score(checklist)
    risk_level = classify_risk_level(risk_score)
    return AnalysisResult(
        risk_score=risk_score,
        risk_level=risk_level,
        checklist=checklist,
        short_term_report="",
        long_term_report="",
        disclaimer="",
        missing_evidence=bundle.missing_fields,
    )
