from __future__ import annotations

from pathlib import Path

from fastapi.testclient import TestClient

from backend.collector.adapters.external_api import (
    dart_evidence_snapshot,
    news_search_results,
    parse_research_preview,
    search_stock_results,
    trade_info_snapshot,
)
from backend.collector.adapters.external_registry import REGISTRY
from backend.main import app


def test_registry_lists_known_external_sources():
    source_ids = {item.source_id for item in REGISTRY}
    assert source_ids == {
        "krx_stock_search",
        "krx_trade_info",
        "naver_news",
        "opendart_evidence",
        "document_parse_research",
    }


def test_search_stock_results_prefers_local_master_matches():
    result = search_stock_results("카카오")

    assert result["ok"] is True
    assert result["source_id"] == "krx_stock_search"
    assert result["results"][0]["corp_name"] == "카카오"


def test_trade_info_snapshot_requires_stock_code_and_market():
    result = trade_info_snapshot("", "")

    assert result["ok"] is False
    assert result["error"]["code"] == "invalid_request"


def test_news_search_results_maps_missing_env_to_typed_failure(monkeypatch):
    monkeypatch.setattr(
        "backend.collector.adapters.external_api.fetch_news_docs",
        lambda query: (_ for _ in ()).throw(
            ValueError("NAVER_CLIENT_ID 또는 NAVER_CLIENT_SECRET이 .env에 없습니다.")
        ),
        raising=False,
    )

    result = news_search_results("카카오")

    assert result["ok"] is False
    assert result["error"]["code"] == "missing_env"


def test_trade_info_snapshot_maps_rate_limit_to_typed_failure(monkeypatch):
    monkeypatch.setattr(
        "backend.collector.adapters.external_api.get_trade_info",
        lambda stock_code, market: (_ for _ in ()).throw(
            RuntimeError("k-skill trade-info API 요청 제한에 걸렸습니다.")
        ),
        raising=False,
    )

    result = trade_info_snapshot("035720", "KOSPI")

    assert result["ok"] is False
    assert result["error"]["code"] == "rate_limited"


def test_dart_evidence_snapshot_maps_filing_and_financial_data(monkeypatch):
    monkeypatch.setattr(
        "backend.collector.adapters.external_api.fetch_disclosures",
        lambda corp_code: [
            type(
                "Disclosure",
                (),
                {
                    "model_dump": lambda self: {
                        "rcept_no": "202605220001",
                        "report_nm": "정관변경결정",
                        "rcept_dt": "20260522",
                        "category": "business_purpose",
                        "url": "https://dart.example/1",
                    }
                },
            )()
        ],
        raising=False,
    )
    monkeypatch.setattr(
        "backend.collector.adapters.external_api.fetch_financials",
        lambda corp_code: type(
            "Financials",
            (),
            {
                "model_dump": lambda self: {
                    "revenue": 100.0,
                    "operating_income": 20.0,
                    "equity": 50.0,
                    "market_cap": None,
                }
            },
        )(),
        raising=False,
    )

    result = dart_evidence_snapshot("00258801")

    assert result["ok"] is True
    assert result["filings"][0]["category"] == "business_purpose"
    assert result["financialSnapshot"]["operating_income"] == 20.0


def test_parse_research_preview_returns_invalid_request_for_missing_file():
    result = parse_research_preview("/no/such/file.pdf")

    assert result["ok"] is False
    assert result["error"]["code"] == "invalid_request"


def test_external_sources_route_returns_registry_rows():
    response = TestClient(app).get("/api/v1/external-sources")

    assert response.status_code == 200
    payload = response.json()
    assert payload["ok"] is True
    assert len(payload["items"]) == 5


def test_stock_search_route_returns_typed_results():
    response = TestClient(app).get("/api/stocks/search?q=카카오")

    assert response.status_code == 200
    payload = response.json()
    assert payload["ok"] is True
    assert payload["results"][0]["corp_name"] == "카카오"


def test_trade_info_route_returns_invalid_request_when_missing_params():
    response = TestClient(app).get("/api/v1/external/trade-info")

    assert response.status_code == 400
    assert response.json()["error"]["code"] == "invalid_request"


def test_news_route_returns_typed_no_result_state(monkeypatch):
    monkeypatch.setattr(
        "backend.collector.adapters.external_api.fetch_news_docs",
        lambda query: [],
        raising=False,
    )

    response = TestClient(app).get("/api/v1/external/news?query=카카오")

    assert response.status_code == 424
    assert response.json()["error"]["code"] == "no_results"


def test_dart_evidence_route_maps_missing_env_to_typed_failure(monkeypatch):
    monkeypatch.setattr(
        "backend.collector.adapters.external_api.fetch_disclosures",
        lambda corp_code: (_ for _ in ()).throw(ValueError("DART_API_KEY가 .env에 없습니다.")),
        raising=False,
    )

    response = TestClient(app).get("/api/v1/external/dart/evidence?corp_code=00258801")

    assert response.status_code == 424
    assert response.json()["error"]["code"] == "missing_env"


def test_parse_preview_route_uses_local_file_contract(monkeypatch):
    temp = Path(__file__).resolve().parents[2] / "data" / "test-parse-preview.txt"
    temp.parent.mkdir(parents=True, exist_ok=True)
    temp.write_text("sample", encoding="utf-8")
    monkeypatch.setattr(
        "backend.collector.adapters.external_api_parse.parse_local_report_file",
        lambda file_path: type(
            "Parsed",
            (),
            {"parsed_text": "# 제목\n\n| A | B |\n| --- | --- |\n| 1 | 2 |"},
        )(),
        raising=False,
    )

    response = TestClient(app).post(
        "/api/v1/external/research/parse-preview",
        json={"file_path": str(temp)},
    )

    assert response.status_code == 200
    payload = response.json()
    assert payload["ok"] is True
    assert payload["report"]["parsed_sections"][0] == "# 제목"
    temp.unlink(missing_ok=True)


def test_parse_preview_route_rejects_out_of_root_path(monkeypatch, tmp_path: Path):
    temp = tmp_path / "outside.txt"
    temp.write_text("sample", encoding="utf-8")

    response = TestClient(app).post(
        "/api/v1/external/research/parse-preview",
        json={"file_path": str(temp)},
    )

    assert response.status_code == 400
    assert response.json()["error"]["code"] == "invalid_request"
