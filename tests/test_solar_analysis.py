from __future__ import annotations

import json
import unittest
from unittest.mock import patch

from backend.analyzer.qa import analyze_bundle, ask_qa
from backend.analyzer.solar_step1 import run_step1
from backend.analyzer.solar_step2 import run_step2
from backend.schemas.analysis import AnalysisResult
from backend.schemas.bundle import (
    CompanyInfo,
    DisclosureItem,
    FinancialData,
    NewsDocument,
    NormalizedDataBundle,
    PriceVolumeData,
)

MOCK_STEP1_RESPONSE = json.dumps(
    {
        "explanations": {
            "business-purpose-change": "정관 변경 공시가 감지되어 사업목적 전환 가능성이 있습니다.",
            "hot-theme-following": (
                "AI 테마 키워드가 반복 언급되고 있어 테마 후행 편승 가능성이 있습니다."
            ),
            "capital-structure-change": "전환사채 발행으로 자본구조 변경 위험이 있습니다.",
            "abnormal-price-surge": "월간 수익률 55% 및 거래량 4.2배 급증으로 비정상 급등입니다.",
            "risky-history": "CB 발행 이력이 감지되어 위험 이력이 존재합니다.",
            "performance-divergence": "재무 데이터 없이 주가가 급등하여 실적 괴리가 의심됩니다.",
        }
    }
)

MOCK_STEP2_NORMAL_RESPONSE = json.dumps(
    {
        "short_term_report": "단기적으로 CB 발행과 주가 급등이 겹쳐 변동성이 높습니다.",
        "long_term_report": "장기적으로 재무 근거 없는 급등은 지속되기 어렵습니다.",
    }
)

MOCK_STEP2_WARNING_RESPONSE = json.dumps(
    {
        "warning_report": (
            "위험도 4점 이상으로 투자 주의가 필요합니다. CB·급등·재무 공백이 동시 감지되었습니다."
        ),
    }
)

MOCK_QA_RESPONSE = "전환사채 발행은 주식 희석 가능성이 있어 주가에 부정적 영향을 줄 수 있습니다."


def _make_bundle(*, high_risk: bool = False) -> NormalizedDataBundle:
    return NormalizedDataBundle(
        company=CompanyInfo(
            corp_name="테스트종목",
            stock_code="000000",
            corp_code="00000000",
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
        financials=FinancialData(
            revenue=None if high_risk else 1000.0,
            operating_income=None,
            equity=None,
        ),
        price_volume=PriceVolumeData(
            monthly_return_max=55.0 if high_risk else 10.0,
            volume_spike_ratio=4.2 if high_risk else 1.0,
        ),
        news_docs=[
            NewsDocument(title="AI 테마 급등", date="20260520", body="AI 관련"),
            NewsDocument(title="AI 모멘텀 지속", date="20260519", body="AI 지속"),
        ],
        missing_fields=["financials"] if high_risk else [],
    )


class SolarStep1Tests(unittest.TestCase):
    def test_run_step1_returns_analysis_result_with_explanations(self) -> None:
        with patch(
            "backend.analyzer.solar_step1.chat_json",
            return_value=json.loads(MOCK_STEP1_RESPONSE),
        ):
            result = run_step1(_make_bundle())

        self.assertIsInstance(result, AnalysisResult)
        self.assertGreaterEqual(result.risk_score, 0)
        self.assertIn(result.risk_level, {"normal", "caution", "high"})
        for item in result.checklist:
            self.assertIn(
                item.id,
                {
                    "business-purpose-change",
                    "hot-theme-following",
                    "capital-structure-change",
                    "abnormal-price-surge",
                    "risky-history",
                    "performance-divergence",
                },
            )

    def test_run_step1_tolerates_solar_api_error(self) -> None:
        from backend.analyzer.solar_client import SolarAPIError

        with patch(
            "backend.analyzer.solar_step1.chat_json",
            side_effect=SolarAPIError("API 실패"),
        ):
            result = run_step1(_make_bundle())

        # Solar 실패해도 정량 결과는 반환
        self.assertIsInstance(result, AnalysisResult)
        for item in result.checklist:
            self.assertEqual(item.solar_explanation, "")

    def test_step1_checklist_has_six_items(self) -> None:
        with patch("backend.analyzer.solar_step1.chat_json", return_value={"explanations": {}}):
            result = run_step1(_make_bundle())
        self.assertEqual(len(result.checklist), 6)


class SolarStep2Tests(unittest.TestCase):
    def _step1_result(
        self, *, high_risk: bool = False
    ) -> tuple[NormalizedDataBundle, AnalysisResult]:
        bundle = _make_bundle(high_risk=high_risk)
        with patch("backend.analyzer.solar_step1.chat_json", return_value={"explanations": {}}):
            result = run_step1(bundle)
        return bundle, result

    def test_run_step2_normal_generates_short_and_long_report(self) -> None:
        bundle, result = self._step1_result(high_risk=False)
        with patch(
            "backend.analyzer.solar_step2.chat_json",
            return_value=json.loads(MOCK_STEP2_NORMAL_RESPONSE),
        ):
            final = run_step2(bundle, result)

        self.assertTrue(final.short_term_report)
        self.assertTrue(final.long_term_report)
        self.assertTrue(final.disclaimer)

    def test_run_step2_high_risk_stops_step2_and_returns_warning(self) -> None:
        bundle, result = self._step1_result(high_risk=True)
        # risk_level을 강제로 high로 설정
        result.risk_level = "high"
        result.risk_score = 4

        with patch(
            "backend.analyzer.solar_step2.chat_json",
            return_value=json.loads(MOCK_STEP2_WARNING_RESPONSE),
        ):
            final = run_step2(bundle, result)

        self.assertTrue(final.short_term_report)
        self.assertEqual(final.long_term_report, "")

    def test_run_step2_tolerates_solar_api_error(self) -> None:
        from backend.analyzer.solar_client import SolarAPIError

        bundle, result = self._step1_result()
        with patch(
            "backend.analyzer.solar_step2.chat_json",
            side_effect=SolarAPIError("API 실패"),
        ):
            final = run_step2(bundle, result)

        self.assertIn("실패", final.short_term_report)


class AnalyzeBundleIntegrationTests(unittest.TestCase):
    def test_analyze_bundle_runs_step1_and_step2(self) -> None:
        bundle = _make_bundle()
        with (
            patch(
                "backend.analyzer.solar_step1.chat_json",
                return_value=json.loads(MOCK_STEP1_RESPONSE),
            ),
            patch(
                "backend.analyzer.solar_step2.chat_json",
                return_value=json.loads(MOCK_STEP2_NORMAL_RESPONSE),
            ),
        ):
            result = analyze_bundle(bundle)

        self.assertTrue(result.short_term_report)
        self.assertTrue(result.disclaimer)
        self.assertEqual(len(result.checklist), 6)


class AskQATests(unittest.TestCase):
    def test_ask_qa_returns_string_answer(self) -> None:
        bundle = _make_bundle()
        with (
            patch(
                "backend.analyzer.solar_step1.chat_json",
                return_value=json.loads(MOCK_STEP1_RESPONSE),
            ),
            patch(
                "backend.analyzer.solar_step2.chat_json",
                return_value=json.loads(MOCK_STEP2_NORMAL_RESPONSE),
            ),
        ):
            analysis = analyze_bundle(bundle)

        with patch("backend.analyzer.qa.chat", return_value=MOCK_QA_RESPONSE):
            answer = ask_qa("CB 발행의 영향은?", bundle, analysis)

        self.assertIsInstance(answer, str)
        self.assertTrue(answer)

    def test_ask_qa_tolerates_solar_api_error(self) -> None:
        from backend.analyzer.solar_client import SolarAPIError

        bundle = _make_bundle()
        with (
            patch(
                "backend.analyzer.solar_step1.chat_json",
                return_value={"explanations": {}},
            ),
            patch(
                "backend.analyzer.solar_step2.chat_json",
                return_value=json.loads(MOCK_STEP2_NORMAL_RESPONSE),
            ),
        ):
            analysis = analyze_bundle(bundle)

        with patch("backend.analyzer.qa.chat", side_effect=SolarAPIError("실패")):
            answer = ask_qa("질문", bundle, analysis)

        self.assertIn("실패", answer)


if __name__ == "__main__":
    unittest.main()
