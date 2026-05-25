from __future__ import annotations

from backend.analyzer.solar_step1 import run_step1
from backend.schemas.analysis import AnalysisResult
from backend.schemas.bundle import NormalizedDataBundle


def analyze_bundle(bundle: NormalizedDataBundle) -> AnalysisResult:
    return run_step1(bundle)
