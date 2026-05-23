from __future__ import annotations

from backend.storage.connection import connect_dev_db
from backend.storage.fixture_loader import read_dev_seed_fixture
from backend.storage.seed import DEV_ADMIN_ID
from backend.storage.sqlite_repositories import SQLiteRepositoryProvider


def test_dev_seed_fixture_shape_covers_demo_states():
    fixture = read_dev_seed_fixture()

    assert fixture["version"] == "dev-seed-v1"
    assert len(fixture["watchlist_items"]) == 2
    assert len(fixture["disclosures"]) == 5
    assert len(fixture["analysis_reports"]) == 3
    assert len(fixture["qa_history"]) == 3
    assert {item["risk_level"] for item in fixture["analysis_reports"]} == {
        "normal",
        "caution",
        "high",
    }


def test_connect_dev_db_loads_fixture_idempotently():
    connection = connect_dev_db(mode="memory")
    provider = SQLiteRepositoryProvider(connection)

    assert len(provider.watchlist.list_for_user(DEV_ADMIN_ID)) == 2
    assert len(provider.disclosures.list_recent(user_id=DEV_ADMIN_ID, limit=10)) == 5
    # list_latest_for_user returns one row per corp_code (latest generated_at);
    # fixture has 3 reports across 2 corp_codes → 2 rows returned
    assert len(provider.reports.list_latest_for_user(DEV_ADMIN_ID)) == 2
    assert len(provider.qa_history.list_for_user(user_id=DEV_ADMIN_ID)) == 3

    from backend.storage.fixture_loader import load_dev_seed_fixture

    load_dev_seed_fixture(connection)

    assert len(provider.watchlist.list_for_user(DEV_ADMIN_ID)) == 2
    assert len(provider.qa_history.list_for_user(user_id=DEV_ADMIN_ID)) == 3
    connection.close()


def test_seed_fixture_preserves_pi_agent_evidence_source():
    connection = connect_dev_db(mode="memory")
    provider = SQLiteRepositoryProvider(connection)

    qa_rows = provider.qa_history.list_for_user(user_id=DEV_ADMIN_ID)

    assert all(row["evidence"][0]["source"] == "pi_agent_http" for row in qa_rows)
    connection.close()
