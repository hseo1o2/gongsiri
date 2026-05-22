from __future__ import annotations

from backend.analyzer.qa import analyze_bundle
from backend.schemas.bundle import (
    CompanyInfo,
    DailyPriceVolume,
    DisclosureItem,
    FinancialData,
    NewsDocument,
    NormalizedDataBundle,
    PriceVolumeData,
)


def _bundle() -> NormalizedDataBundle:
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
            )
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


def test_analyze_bundle_returns_deterministic_facts_without_final_prose_dependency():
    result = analyze_bundle(_bundle())

    assert result.risk_score >= 0
    assert result.risk_level in {"normal", "caution", "high"}
    assert len(result.checklist) == 6
    assert result.short_term_report == ""
    assert result.long_term_report == ""
    assert result.disclaimer == ""
    assert all(item.solar_explanation == item.reason for item in result.checklist)
