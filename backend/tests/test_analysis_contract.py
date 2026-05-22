from __future__ import annotations

from backend.analyzer.checklist import build_checklist, calculate_risk_score, classify_risk_level
from backend.schemas.analysis import AnalysisResult
from backend.schemas.bundle import (
    CompanyInfo,
    DailyPriceVolume,
    DisclosureItem,
    FinancialData,
    NewsDocument,
    NormalizedDataBundle,
    PriceVolumeData,
)


def _bundle_fixture() -> NormalizedDataBundle:
    return NormalizedDataBundle(
        company=CompanyInfo(
            corp_name="카카오",
            stock_code="035720",
            corp_code="00258801",
            market="KOSPI",
        ),
        disclosures=[
            DisclosureItem(
                rcept_no="202605220001",
                report_nm="정관변경결정",
                rcept_dt="20260522",
                parsed_text="사업목적 추가",
                category="business_purpose",
            ),
            DisclosureItem(
                rcept_no="202605220002",
                report_nm="최대주주변경",
                rcept_dt="20260521",
                parsed_text="최대주주 변경",
                category="largest_shareholder_change",
            ),
        ],
        financials=FinancialData(),
        price_volume=PriceVolumeData(
            daily=[DailyPriceVolume(date="20260522", close=42000, volume=1000000)],
            monthly_return_max=55.0,
            volume_spike_ratio=3.2,
        ),
        news_docs=[
            NewsDocument(title="카카오 AI 신사업 확대", date="2026-05-22", body="AI 투자 확대"),
            NewsDocument(title="카카오 2차전지 테마 언급", date="2026-05-21", body="2차전지 협업"),
        ],
        missing_fields=["financials.revenue"],
    )


def test_checklist_contract_has_stable_ids_and_structured_evidence_fields():
    checklist = build_checklist(_bundle_fixture())

    assert [item.id for item in checklist] == [
        "business-purpose-change",
        "hot-theme-following",
        "capital-structure-change",
        "abnormal-price-surge",
        "risky-history",
        "performance-divergence",
    ]
    assert all(item.source == "deterministic_backend" for item in checklist)
    assert all(hasattr(item, "observed_at") for item in checklist)
    assert all(isinstance(item.evidence, list) for item in checklist)
    assert all(isinstance(item.evidence_refs, list) for item in checklist)
    assert checklist[0].evidence_refs[0].source == "dart_disclosure"
    assert checklist[1].evidence_refs[0].source == "naver_news"
    assert checklist[3].evidence_refs[0].source == "krx_trade_info"


def test_analysis_result_serializes_structured_checklist_without_losing_guard_fields():
    checklist = build_checklist(_bundle_fixture())
    analysis_result = AnalysisResult(
        risk_score=calculate_risk_score(checklist),
        risk_level=classify_risk_level(calculate_risk_score(checklist)),
        checklist=checklist,
        short_term_report="",
        long_term_report="",
        disclaimer="공시 기반 위험 점검입니다.",
        missing_evidence=["financials.revenue"],
    )

    payload = analysis_result.model_dump()

    assert payload["risk_score"] == analysis_result.risk_score
    assert payload["risk_level"] == analysis_result.risk_level
    assert payload["checklist"][0]["source"] == "deterministic_backend"
    assert payload["checklist"][0]["evidence_refs"][0]["source"] == "dart_disclosure"
    assert "observed_at" in payload["checklist"][0]
