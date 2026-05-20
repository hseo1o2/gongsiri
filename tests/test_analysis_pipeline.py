from __future__ import annotations

import unittest
from unittest.mock import patch

from backend.analyzer.pipeline import run_pipeline_request
from backend.analyzer.qa import analyze_bundle
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


def make_bundle() -> NormalizedDataBundle:
    return NormalizedDataBundle(
        company=CompanyInfo(
            corp_name="카카오",
            stock_code="035720",
            corp_code="00258801",
            market="KOSPI",
        ),
        disclosures=[
            DisclosureItem(
                rcept_no="202605200001",
                report_nm="전환사채 발행 결정",
                rcept_dt="20260520",
                category="convertible_bond",
            )
        ],
        financials=FinancialData(revenue=None, operating_income=None, equity=None, market_cap=None),
        price_volume=PriceVolumeData(
            daily=[DailyPriceVolume(date="20260520", close=100000, volume=1000000)],
            monthly_return_max=55.0,
            volume_spike_ratio=4.2,
        ),
        news_docs=[
            NewsDocument(
                title="카카오 AI 테마 급등",
                date="20260520",
                body="AI 관련 테마 뉴스",
            )
        ],
        parsed_reports=[],
        missing_fields=["parsed_reports"],
    )


class AnalysisPipelineTests(unittest.TestCase):
    def test_analyze_bundle_builds_machine_readable_result(self) -> None:
        result = analyze_bundle(make_bundle())

        self.assertIsInstance(result, AnalysisResult)
        self.assertGreaterEqual(result.risk_score, 1)
        self.assertIn(result.risk_level, {"normal", "caution", "high"})
        self.assertTrue(result.short_term_report)
        self.assertTrue(result.disclaimer)

    def test_run_pipeline_request_supports_corp_code_path(self) -> None:
        with patch(
            "backend.analyzer.pipeline.build_runtime_normalized_bundle",
            return_value=make_bundle(),
        ) as builder:
            result = run_pipeline_request(
                {"source": "system", "corpCode": "00258801"},
                trace_id="trace",
            )

        self.assertTrue(result["ok"])
        self.assertEqual(result["traceId"], "trace")
        self.assertEqual(result["triggerSource"], "system")
        builder.assert_called_once_with(keyword=None, corp_code="00258801")

    def test_run_pipeline_request_returns_typed_failure_when_analyzer_raises(self) -> None:
        with patch(
            "backend.analyzer.pipeline.build_runtime_normalized_bundle",
            return_value=make_bundle(),
        ), patch(
            "backend.analyzer.pipeline.analyze_bundle",
            side_effect=RuntimeError("analysis exploded"),
        ):
            result = run_pipeline_request({"source": "cron", "keyword": "카카오"}, trace_id="trace")

        self.assertFalse(result["ok"])
        self.assertEqual(result["error"]["code"], "analysis_failed")
        self.assertEqual(result["triggerSource"], "cron")


if __name__ == "__main__":
    unittest.main()
