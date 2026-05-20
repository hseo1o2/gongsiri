from __future__ import annotations

from backend.schemas.analysis import AnalysisResult
from backend.schemas.bundle import NormalizedDataBundle


def summarize_long_term(bundle: NormalizedDataBundle, analysis_result: AnalysisResult) -> str:
    if analysis_result.risk_level == "high":
        return (
            f"{bundle.company.corp_name}는 누적 위험 점수가 높아 "
            "장기 보유 전 추가 공시 확인이 필요합니다."
        )

    if analysis_result.risk_level == "caution":
        return (
            f"{bundle.company.corp_name}는 중기적으로 추가 공시와 실적 흐름을 함께 "
            "확인하는 보수적 접근이 필요합니다."
        )

    return f"{bundle.company.corp_name}는 장기적으로도 현재 공시 기준 위험 신호가 제한적입니다."


def build_disclaimer() -> str:
    return "본 결과는 공시/시세/뉴스 기반 점검용 참고 자료이며 투자 판단을 대체하지 않습니다."
