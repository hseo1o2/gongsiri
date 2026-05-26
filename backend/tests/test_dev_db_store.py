from __future__ import annotations

from pathlib import Path

from backend.storage.connection import (
    connect_dev_db,
    get_repository_provider,
    reset_repository_provider,
)
from backend.storage.schema import SCHEMA_VERSION
from backend.storage.seed import DEV_ADMIN_ID, DEV_ADMIN_PASSWORD, DEV_ADMIN_USERNAME
from backend.storage.sqlite_repositories import SQLiteRepositoryProvider

NOW = "2026-05-22T01:00:00Z"


def test_default_provider_uses_file_mode_and_seeds_admin(tmp_path, monkeypatch):
    db_path = tmp_path / "test_default.sqlite"
    monkeypatch.delenv("GONGSIRI_DB_MODE", raising=False)
    monkeypatch.setenv("GONGSIRI_DB_PATH", str(db_path))
    reset_repository_provider()

    provider = get_repository_provider()
    admin = provider.users.get_by_username(DEV_ADMIN_USERNAME)

    assert admin is not None
    assert admin["id"] == DEV_ADMIN_ID
    assert admin["password_secret"] == DEV_ADMIN_PASSWORD
    assert admin["source_version"] == SCHEMA_VERSION
    reset_repository_provider()


def test_file_mode_creates_parent_directory_and_seeds_admin(tmp_path, monkeypatch):
    db_path = tmp_path / "nested" / "dev.sqlite"
    monkeypatch.setenv("GONGSIRI_DB_MODE", "file")
    monkeypatch.setenv("GONGSIRI_DB_PATH", str(db_path))

    connection = connect_dev_db()
    provider = SQLiteRepositoryProvider(connection)

    assert Path(db_path).exists()
    assert provider.users.get_by_username("admin") is not None
    connection.close()


def test_repository_provider_round_trips_watchlist_report_and_qa():
    connection = connect_dev_db(mode="memory")
    provider = SQLiteRepositoryProvider(connection)

    watch = provider.watchlist.upsert_item(
        {
            "id": "watch-kakao",
            "user_id": DEV_ADMIN_ID,
            "corp_code": "00258801",
            "corp_name": "카카오",
            "stock_code": "035720",
            "market": "KOSPI",
            "added_at": NOW,
            "source_version": SCHEMA_VERSION,
        }
    )
    provider.reports.save_detail(
        {
            "id": "report-kakao-1",
            "user_id": DEV_ADMIN_ID,
            "corp_code": "00258801",
            "corp_name": "카카오",
            "risk_level": "caution",
            "risk_score": 2,
            "checklist": [{"id": "price_surge", "status": "fail"}],
            "short_term_report": "저 공시리가 확인한 단기 리포트입니다.",
            "long_term_report": "장기 리포트",
            "disclaimer": "투자 판단 참고용입니다.",
            "missing_evidence": [],
            "request_context": {"source": "test", "corpCode": "00258801"},
            "source_timestamps": {"latestDisclosureDate": "20260522"},
            "strict_pi_sdk": 1,
            "generated_at": NOW,
            "source_version": SCHEMA_VERSION,
        }
    )
    provider.qa_history.save_answer(
        {
            "id": "qa-kakao-1",
            "user_id": DEV_ADMIN_ID,
            "corp_code": "00258801",
            "corp_name": "카카오",
            "question": "최근 공시 요약?",
            "answer": "저 공시리가 근거 기반으로 답했습니다.",
            "evidence": [{"source": "pi_agent_http"}],
            "asked_at": NOW,
            "source_version": SCHEMA_VERSION,
        }
    )

    assert watch["corp_name"] == "카카오"
    assert any(
        item["corp_code"] == "00258801" for item in provider.watchlist.list_for_user(DEV_ADMIN_ID)
    )
    assert (
        provider.reports.get_latest_detail(user_id=DEV_ADMIN_ID, corp_code="00258801")["checklist"][
            0
        ]["id"]
        == "price_surge"
    )
    assert provider.qa_history.list_for_user(user_id=DEV_ADMIN_ID)[0]["evidence"] == [
        {"source": "pi_agent_http"}
    ]
    connection.close()


def test_fastapi_lifespan_initializes_dev_repository(tmp_path, monkeypatch):
    from fastapi.testclient import TestClient

    from backend.main import app

    monkeypatch.setenv("GONGSIRI_DB_MODE", "file")
    monkeypatch.setenv("GONGSIRI_DB_PATH", str(tmp_path / "lifespan_test.sqlite"))
    reset_repository_provider()

    with TestClient(app):
        admin = get_repository_provider().users.get_by_username("admin")

    assert admin is not None
    assert admin["id"] == DEV_ADMIN_ID
    reset_repository_provider()
