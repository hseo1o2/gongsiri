import json
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

from backend.collector.krx import search
from backend.schemas.bundle import CompanyInfo


class KRXSearchTests(unittest.TestCase):
    def setUp(self) -> None:
        self.temp_dir = tempfile.TemporaryDirectory()
        self.stock_master_path = Path(self.temp_dir.name) / "stock_master.json"
        self.stock_master_path.write_text(
            json.dumps(search.DEFAULT_LOCAL_STOCKS, ensure_ascii=False, indent=2),
            encoding="utf-8",
        )
        search.SEARCH_CACHE.clear()

    def tearDown(self) -> None:
        search.SEARCH_CACHE.clear()
        self.temp_dir.cleanup()

    def read_master(self) -> dict[str, dict[str, str]]:
        return json.loads(self.stock_master_path.read_text(encoding="utf-8"))

    def test_find_in_local_master_supports_exact_and_partial_match(self) -> None:
        with patch.object(search, "STOCK_MASTER_PATH", self.stock_master_path):
            exact = search.find_in_local_master("카카오")
            partial = search.find_in_local_master("카카")

        self.assertIsNotNone(exact)
        self.assertEqual(exact.corp_code, "00258801")
        self.assertIsNotNone(partial)
        self.assertEqual(partial.corp_name, "카카오")

    def test_resolve_company_read_only_does_not_mutate_stock_master(self) -> None:
        baseline = self.read_master()
        remote_result = CompanyInfo(
            corp_name="테스트주식",
            stock_code="123456",
            corp_code="65432100",
            market="KOSDAQ",
        )

        with (
            patch.object(search, "STOCK_MASTER_PATH", self.stock_master_path),
            patch.object(search, "find_in_local_master", return_value=None),
            patch.object(search, "search_stock_from_kskill", return_value=remote_result),
            patch.object(search, "save_company_to_master") as save_mock,
        ):
            resolved = search.resolve_company_read_only("테스트주식")

        self.assertEqual(resolved, remote_result)
        self.assertEqual(search.SEARCH_CACHE["테스트주식"], remote_result)
        save_mock.assert_not_called()
        self.assertEqual(self.read_master(), baseline)

    def test_search_stock_persists_remote_lookup_for_existing_behavior(self) -> None:
        remote_result = CompanyInfo(
            corp_name="새종목",
            stock_code="999999",
            corp_code="00009999",
            market="KOSDAQ",
        )

        with (
            patch.object(search, "STOCK_MASTER_PATH", self.stock_master_path),
            patch.object(search, "find_in_local_master", return_value=None),
            patch.object(search, "search_stock_from_kskill", return_value=remote_result),
        ):
            resolved = search.search_stock("새종목")

        self.assertEqual(resolved, remote_result)
        self.assertIn("새종목", self.read_master())
        self.assertEqual(self.read_master()["새종목"]["corp_code"], "00009999")
