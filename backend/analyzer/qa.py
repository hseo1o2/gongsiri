from __future__ import annotations

from backend.analyzer.solar_step1 import run_step1, summarize_short_term
from backend.analyzer.solar_step2 import build_disclaimer, summarize_long_term
from backend.schemas.analysis import AnalysisResult
from backend.schemas.bundle import NormalizedDataBundle


def analyze_bundle(bundle: NormalizedDataBundle) -> AnalysisResult:
    analysis_result = run_step1(bundle)
    analysis_result.short_term_report = summarize_short_term(bundle, analysis_result)
    analysis_result.long_term_report = summarize_long_term(bundle, analysis_result)
    analysis_result.disclaimer = build_disclaimer()
    return analysis_result
