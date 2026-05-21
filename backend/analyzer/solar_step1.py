from __future__ import annotations

from backend.analyzer.checklist import build_checklist, calculate_risk_score, classify_risk_level
from backend.analyzer.prompts import step1 as step1_prompts
from backend.analyzer.solar_client import SolarAPIError, chat_json
from backend.schemas.analysis import AnalysisResult, ChecklistItem
from backend.schemas.bundle import NormalizedDataBundle


def _enrich_with_explanations(
    checklist: list[ChecklistItem],
    explanations: dict[str, str],
) -> list[ChecklistItem]:
    for item in checklist:
        item.solar_explanation = explanations.get(item.id, "")
    return checklist


def run_step1(bundle: NormalizedDataBundle) -> AnalysisResult:
    checklist = build_checklist(bundle)
    risk_score = calculate_risk_score(checklist)
    risk_level = classify_risk_level(risk_score)

    checklist_summary = [
        {
            "id": item.id,
            "title": item.title,
            "status": item.status,
            "score": item.score,
            "reason": item.reason,
            "evidence": item.evidence,
        }
        for item in checklist
    ]

    disclosure_texts = [
        " ".join(filter(None, [d.report_nm, d.parsed_text])) for d in bundle.disclosures
    ]
    news_titles = [n.title for n in bundle.news_docs]
    financials = {
        "revenue": bundle.financials.revenue,
        "operating_income": bundle.financials.operating_income,
        "equity": bundle.financials.equity,
    }
    price_signals = {
        "monthly_return_max": bundle.price_volume.monthly_return_max,
        "volume_spike_ratio": bundle.price_volume.volume_spike_ratio,
    }

    messages = step1_prompts.build_messages(
        corp_name=bundle.company.corp_name,
        checklist_summary=checklist_summary,
        disclosure_texts=disclosure_texts,
        news_titles=news_titles,
        financials=financials,
        price_signals=price_signals,
    )

    try:
        result = chat_json(messages, retries=1)
        explanations: dict[str, str] = result.get("explanations", {})
    except SolarAPIError:
        explanations = {}

    enriched_checklist = _enrich_with_explanations(checklist, explanations)

    return AnalysisResult(
        risk_score=risk_score,
        risk_level=risk_level,
        checklist=enriched_checklist,
        short_term_report="",
        long_term_report="",
        disclaimer="",
        missing_evidence=bundle.missing_fields,
    )
