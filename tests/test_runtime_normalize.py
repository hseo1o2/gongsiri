from __future__ import annotations

import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

from backend.collector.runtime_normalize import (
    get_local_report_files_read_only,
    resolve_runtime_company,
)
from backend.schemas.bundle import CompanyInfo


class RuntimeNormalizeTests(unittest.TestCase):
    def test_resolve_runtime_company_supports_corp_code_only(self) -> None:
        with patch(
            "backend.collector.runtime_normalize.find_by_corp_code",
            return_value=CompanyInfo(
                corp_name="카카오",
                stock_code="035720",
                corp_code="00258801",
                market="KOSPI",
            ),
        ):
            company = resolve_runtime_company(corp_code="00258801")

        self.assertEqual(company.corp_name, "카카오")
        self.assertEqual(company.corp_code, "00258801")

    def test_resolve_runtime_company_supports_keyword_corpcode_pair(self) -> None:
        with patch(
            "backend.collector.runtime_normalize.find_by_corp_code",
            return_value=None,
        ), patch(
            "backend.collector.runtime_normalize.resolve_company_read_only",
            return_value=CompanyInfo(
                corp_name="카카오",
                stock_code="035720",
                corp_code="00258801",
                market="KOSPI",
            ),
        ):
            company = resolve_runtime_company(keyword="카카오", corp_code="00258801")

        self.assertEqual(company.corp_name, "카카오")
        self.assertEqual(company.corp_code, "00258801")

    def test_get_local_report_files_read_only_keeps_invalid_pdf(self) -> None:
        with tempfile.TemporaryDirectory() as temp_dir:
            invalid_pdf = Path(temp_dir) / "broken.pdf"
            invalid_pdf.write_text("not a pdf", encoding="utf-8")

            files = get_local_report_files_read_only(temp_dir)
            exists_after_read = invalid_pdf.exists()

        self.assertIn(str(invalid_pdf), files)
        self.assertTrue(exists_after_read)


if __name__ == "__main__":
    unittest.main()
