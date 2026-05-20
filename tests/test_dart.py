import unittest
from unittest.mock import Mock, patch

from backend.collector import dart


class DartCollectorTests(unittest.TestCase):
    def test_classify_disclosure_covers_known_categories(self) -> None:
        self.assertEqual(dart.classify_disclosure("전환사채 발행 결정"), "convertible_bond")
        self.assertEqual(dart.classify_disclosure("유상증자 결정"), "paid_in_capital_increase")
        self.assertEqual(dart.classify_disclosure("분기보고서"), "quarterly_report")
        self.assertEqual(dart.classify_disclosure("기타 공시"), "other")

    def test_fetch_disclosures_requires_dart_api_key(self) -> None:
        with patch.object(dart, "get_dart_api_key", return_value=None):
            with self.assertRaisesRegex(ValueError, "DART_API_KEY"):
                dart.fetch_disclosures("00126380")

    def test_fetch_disclosures_maps_rows_to_disclosure_items(self) -> None:
        response = Mock()
        response.raise_for_status.return_value = None
        response.json.return_value = {
            "status": "000",
            "list": [
                {
                    "rcept_no": "20260520000123",
                    "report_nm": "분기보고서",
                    "rcept_dt": "20260520",
                }
            ],
        }

        with (
            patch.object(dart, "get_dart_api_key", return_value="test-key"),
            patch.object(dart.requests, "get", return_value=response) as get_mock,
        ):
            disclosures = dart.fetch_disclosures("00126380", bgn_de="20250101", end_de="20250131")

        get_mock.assert_called_once()
        self.assertEqual(len(disclosures), 1)
        self.assertEqual(disclosures[0].category, "quarterly_report")
        self.assertEqual(
            disclosures[0].url,
            "https://dart.fss.or.kr/dsaf001/main.do?rcpNo=20260520000123",
        )

    def test_fetch_disclosures_raises_runtime_error_for_dart_status_failure(self) -> None:
        response = Mock()
        response.raise_for_status.return_value = None
        response.json.return_value = {"status": "013", "message": "No data"}

        with (
            patch.object(dart, "get_dart_api_key", return_value="test-key"),
            patch.object(dart.requests, "get", return_value=response),
        ):
            with self.assertRaisesRegex(RuntimeError, "OpenDART API error"):
                dart.fetch_disclosures("00126380")
