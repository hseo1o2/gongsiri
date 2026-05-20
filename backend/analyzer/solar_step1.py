from __future__ import annotations

from backend.analyzer.checklist import build_checklist, calculate_risk_score, classify_risk_level
from backend.schemas.analysis import AnalysisResult
from backend.schemas.bundle import NormalizedDataBundle


def summarize_short_term(bundle: NormalizedDataBundle, analysis_result: AnalysisResult) -> str:
    failed_titles = [item.title for item in analysis_result.checklist if item.status == "fail"]

    if not failed_titles:
        return f"{bundle.company.corp_name}는 단기적으로 공시 기반 위험 신호가 제한적입니다."

    return (
        f"{bundle.company.corp_name}는 단기적으로 "
        f"{', '.join(failed_titles[:3])} 중심의 위험 신호가 감지되었습니다."
    )


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
