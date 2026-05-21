from __future__ import annotations

from backend.analyzer.prompts import qa_prompt
from backend.analyzer.solar_client import SolarAPIError, chat
from backend.analyzer.solar_step1 import run_step1
from backend.analyzer.solar_step2 import run_step2
from backend.schemas.analysis import AnalysisResult
from backend.schemas.bundle import NormalizedDataBundle


def analyze_bundle(bundle: NormalizedDataBundle) -> AnalysisResult:
    result = run_step1(bundle)
    result = run_step2(bundle, result)
    return result


def ask_qa(
    question: str,
    bundle: NormalizedDataBundle,
    analysis_result: AnalysisResult,
) -> str:
    checklist_summary = [
        {
            "status": item.status,
            "title": item.title,
            "reason": item.reason,
            "solar_explanation": item.solar_explanation,
        }
        for item in analysis_result.checklist
    ]
    disclosure_texts = [
        " ".join(filter(None, [d.report_nm, d.parsed_text])) for d in bundle.disclosures
    ]

    messages = qa_prompt.build_messages(
        question=question,
        corp_name=bundle.company.corp_name,
        disclosure_texts=disclosure_texts,
        checklist_summary=checklist_summary,
        risk_level=analysis_result.risk_level,
    )

    try:
        return chat(messages, temperature=0.3, max_tokens=1024)
    except SolarAPIError as exc:
        return f"답변 생성에 실패했습니다: {exc}"
