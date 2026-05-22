from __future__ import annotations

from fastapi.testclient import TestClient

from backend.main import app
from backend.storage.connection import reset_repository_provider

LOGIN_PATH = "/api/v1/dev/auth/login"


def test_dev_auth_is_disabled_without_env(monkeypatch):
    monkeypatch.delenv("GONGSIRI_AUTH_MODE", raising=False)
    reset_repository_provider()

    with TestClient(app) as client:
        response = client.post(LOGIN_PATH, json={"username": "admin", "password": "admin"})

    assert response.status_code == 403
    assert response.json()["error"]["code"] == "dev_auth_disabled"
    reset_repository_provider()


def test_admin_admin_login_returns_public_dev_session(monkeypatch):
    monkeypatch.setenv("GONGSIRI_AUTH_MODE", "dev")
    reset_repository_provider()

    with TestClient(app) as client:
        response = client.post(LOGIN_PATH, json={"username": "admin", "password": "admin"})

    body = response.json()
    assert response.status_code == 200
    assert body["ok"] is True
    assert body["session"]["userId"] == "dev-admin"
    assert body["session"]["role"] == "admin"
    assert body["token"] == "dev-session:dev-admin"
    assert "password_secret" not in str(body)
    reset_repository_provider()


def test_invalid_dev_credentials_fail_without_token(monkeypatch):
    monkeypatch.setenv("GONGSIRI_AUTH_MODE", "dev")
    reset_repository_provider()

    with TestClient(app) as client:
        response = client.post(LOGIN_PATH, json={"username": "admin", "password": "wrong"})

    body = response.json()
    assert response.status_code == 401
    assert body["error"]["code"] == "invalid_credentials"
    assert "token" not in body
    reset_repository_provider()
