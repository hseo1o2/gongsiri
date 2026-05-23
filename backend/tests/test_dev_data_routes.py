from __future__ import annotations

from fastapi.testclient import TestClient

from backend.main import app
from backend.storage.connection import reset_repository_provider

DASHBOARD_PATH = "/api/v1/dev/dashboard"
WATCHLIST_PATH = "/api/v1/dev/watchlist"
DISCLOSURES_PATH = "/api/v1/dev/disclosures/recent"


def test_dev_dashboard_requires_dev_auth_mode(monkeypatch):
    monkeypatch.delenv("GONGSIRI_AUTH_MODE", raising=False)
    reset_repository_provider()

    with TestClient(app) as client:
        response = client.get(DASHBOARD_PATH)

    assert response.status_code == 403
    assert response.json()["error"]["code"] == "dev_auth_disabled"
    reset_repository_provider()


def test_dashboard_reads_seeded_admin_scope_from_dev_db(monkeypatch):
    monkeypatch.setenv("GONGSIRI_AUTH_MODE", "dev")
    reset_repository_provider()

    with TestClient(app) as client:
        response = client.get(DASHBOARD_PATH)

    body = response.json()
    assert response.status_code == 200
    assert body["summary"] == {
        "count": 2,
        "todayDisclosures": 2,
        "cautionCount": 1,
        "dangerCount": 0,
    }
    assert {item["corp_code"] for item in body["watchlist"]} == {
        "00126380",
        "00258801",
    }
    assert body["recentDisclosures"][0]["corp_name"] in {"카카오", "삼성전자"}
    reset_repository_provider()


def test_watchlist_add_and_delete_persist_in_dev_db(monkeypatch):
    monkeypatch.setenv("GONGSIRI_AUTH_MODE", "dev")
    reset_repository_provider()

    payload = {
        "corp_code": "00247540",
        "corp_name": "에코프로비엠",
        "stock_code": "247540",
        "market": "KOSDAQ",
    }
    with TestClient(app) as client:
        created = client.post(WATCHLIST_PATH, json=payload)
        listed = client.get(WATCHLIST_PATH)
        deleted = client.delete(f"{WATCHLIST_PATH}/00247540")
        listed_after_delete = client.get(WATCHLIST_PATH)

    assert created.status_code == 201
    assert created.json()["item"]["risk_level"] == "normal"
    assert any(item["corp_code"] == "00247540" for item in listed.json()["items"])
    assert deleted.status_code == 200
    assert not any(item["corp_code"] == "00247540" for item in listed_after_delete.json()["items"])
    reset_repository_provider()


def test_recent_disclosures_are_joined_to_admin_watchlist(monkeypatch):
    monkeypatch.setenv("GONGSIRI_AUTH_MODE", "dev")
    reset_repository_provider()

    with TestClient(app) as client:
        response = client.get(DISCLOSURES_PATH)

    body = response.json()
    assert response.status_code == 200
    assert len(body["items"]) == 5
    assert {item["risk_level"] for item in body["items"]} >= {"normal", "caution"}
    reset_repository_provider()
