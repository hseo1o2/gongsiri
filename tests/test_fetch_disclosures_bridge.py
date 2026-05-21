from __future__ import annotations

import io
import json
import os
import subprocess
import sys
import unittest
from contextlib import redirect_stderr, redirect_stdout
from datetime import UTC, datetime
from pathlib import Path
from unittest.mock import Mock, patch

from backend.collector.bridge.disclosures import run_fetch_disclosures_request
from backend.collector.cli.fetch_disclosures import main
from backend.collector.company_resolver import resolve_company_read_only
from backend.collector.krx.search import STOCK_MASTER_PATH
from backend.schemas.bundle import CompanyInfo, DisclosureItem

FIXED_NOW = datetime(2026, 5, 20, 12, 0, tzinfo=UTC)


class FetchDisclosuresBridgeTests(unittest.TestCase):
    def test_corp_code_direct_path_bypasses_resolver(self) -> None:
        fetcher = Mock(
            return_value=[
                DisclosureItem(
                    rcept_no="202605200001",
                    report_nm="사업보고서",
                    rcept_dt="20260520",
                    url="https://dart.example/report",
                    category="annual_report",
                )
            ]
        )
        resolver = Mock(side_effect=AssertionError("resolver should not be called"))

        result = run_fetch_disclosures_request(
            {"corpCode": "00126380"},
            resolver=resolver,
            fetcher=fetcher,
            trace_id="trace-direct",
            now=FIXED_NOW,
        )

        self.assertTrue(result["ok"])
        fetcher.assert_called_once_with("00126380", "20240101", "20241231", 20)
        self.assertEqual(result["traceId"], "trace-direct")
        self.assertEqual(result["evidence"][0]["source"], "corp_code_input")
        self.assertEqual(result["data"]["corpCode"], "00126380")

    def test_keyword_path_resolves_company_before_fetch(self) -> None:
        fetcher = Mock(return_value=[])
        resolver = Mock(
            return_value=CompanyInfo(
                corp_name="카카오",
                stock_code="035720",
                corp_code="00258801",
                market="KOSPI",
            )
        )

        result = run_fetch_disclosures_request(
            {"keyword": "카카오", "pageCount": 5},
            resolver=resolver,
            fetcher=fetcher,
            trace_id="trace-keyword",
            now=FIXED_NOW,
        )

        self.assertTrue(result["ok"])
        resolver.assert_called_once_with("카카오")
        fetcher.assert_called_once_with("00258801", "20240101", "20241231", 5)
        self.assertEqual(result["evidence"][0]["source"], "keyword_resolution")
        self.assertEqual(result["data"]["company"]["corp_name"], "카카오")

    def test_unresolved_keyword_maps_to_typed_failure(self) -> None:
        result = run_fetch_disclosures_request(
            {"keyword": "없는회사"},
            resolver=Mock(side_effect=RuntimeError("종목 검색 실패: 없는회사")),
            fetcher=Mock(),
            trace_id="trace-unresolved",
            now=FIXED_NOW,
        )

        self.assertFalse(result["ok"])
        self.assertEqual(result["error"]["code"], "corp_code_unresolved")
        self.assertEqual(result["traceId"], "trace-unresolved")

    def test_missing_env_maps_to_typed_failure(self) -> None:
        result = run_fetch_disclosures_request(
            {"corpCode": "00126380"},
            resolver=Mock(),
            fetcher=Mock(side_effect=ValueError("DART_API_KEY가 .env에 없습니다.")),
            trace_id="trace-env",
            now=FIXED_NOW,
        )

        self.assertFalse(result["ok"])
        self.assertEqual(result["error"]["code"], "missing_env")

    def test_dart_api_error_maps_to_typed_failure(self) -> None:
        result = run_fetch_disclosures_request(
            {"corpCode": "00126380"},
            resolver=Mock(),
            fetcher=Mock(side_effect=RuntimeError("OpenDART API error: 013 / NO_DATA")),
            trace_id="trace-dart",
            now=FIXED_NOW,
        )

        self.assertFalse(result["ok"])
        self.assertEqual(result["error"]["code"], "dart_api_error")

    def test_read_only_resolver_does_not_mutate_stock_master(self) -> None:
        before = STOCK_MASTER_PATH.read_text(encoding="utf-8")

        with (
            patch(
                "backend.collector.company_resolver.find_in_local_master",
                return_value=None,
            ),
            patch(
                "backend.collector.company_resolver.search_stock_from_kskill",
                return_value=CompanyInfo(
                    corp_name="테스트",
                    stock_code="000001",
                    corp_code="99999999",
                    market="KOSDAQ",
                ),
            ),
        ):
            company = resolve_company_read_only("테스트")

        after = STOCK_MASTER_PATH.read_text(encoding="utf-8")
        self.assertEqual(company.corp_code, "99999999")
        self.assertEqual(before, after)


class FetchDisclosuresCliTests(unittest.TestCase):
    def test_main_writes_json_to_stdout_only(self) -> None:
        stdout = io.StringIO()
        stderr = io.StringIO()

        with (
            patch(
                "backend.collector.cli.fetch_disclosures.run_fetch_disclosures_request",
                return_value={
                    "ok": True,
                    "traceId": "trace-cli",
                    "contractVersion": "v1",
                    "observedAt": "2026-05-20T12:00:00Z",
                    "data": {"corpCode": "00126380", "company": None, "disclosures": []},
                    "evidence": [],
                },
            ),
            patch("sys.stdin", io.StringIO("")),
            redirect_stdout(stdout),
            redirect_stderr(stderr),
        ):
            exit_code = main(["--corp-code", "00126380"])

        self.assertEqual(exit_code, 0)
        self.assertEqual(stderr.getvalue(), "")
        payload = json.loads(stdout.getvalue())
        self.assertTrue(payload["ok"])
        self.assertEqual(payload["traceId"], "trace-cli")

    def test_subprocess_missing_env_returns_machine_readable_failure(self) -> None:
        env = {
            "PATH": os.environ["PATH"],
            "PYTHONPATH": str(Path.cwd()),
            "PYTHON_DOTENV_DISABLED": "1",
        }

        completed = subprocess.run(
            [
                sys.executable,
                "-m",
                "backend.collector.cli.fetch_disclosures",
                "--corp-code",
                "00126380",
                "--trace-id",
                "trace-subprocess",
            ],
            cwd=Path.cwd(),
            env=env,
            capture_output=True,
            text=True,
            check=False,
        )

        self.assertEqual(completed.returncode, 1)
        self.assertEqual(completed.stderr, "")
        payload = json.loads(completed.stdout)
        self.assertFalse(payload["ok"])
        self.assertEqual(payload["traceId"], "trace-subprocess")
        self.assertEqual(payload["error"]["code"], "missing_env")


if __name__ == "__main__":
    unittest.main()
