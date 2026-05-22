from __future__ import annotations

import json
import sqlite3
from pathlib import Path
from typing import Any

from backend.storage.seed import DEV_ADMIN_ID
from backend.storage.sqlite_repositories import SQLiteRepositoryProvider

DEFAULT_FIXTURE_PATH = Path(__file__).resolve().parents[1] / "fixtures" / "dev_seed.json"
REQUIRED_COLLECTIONS = ("watchlist_items", "disclosures", "analysis_reports", "qa_history")


def load_dev_seed_fixture(
    connection: sqlite3.Connection, fixture_path: Path = DEFAULT_FIXTURE_PATH
) -> dict[str, int]:
    fixture = read_dev_seed_fixture(fixture_path)
    provider = SQLiteRepositoryProvider(connection)
    _ensure_user_matches_admin(fixture)
    for item in fixture["watchlist_items"]:
        provider.watchlist.upsert_item(dict(item))
    provider.disclosures.upsert_many([dict(item) for item in fixture["disclosures"]])
    for report in fixture["analysis_reports"]:
        provider.reports.save_detail(dict(report))
    for item in fixture["qa_history"]:
        provider.qa_history.save_answer(dict(item))
    return {name: len(fixture[name]) for name in REQUIRED_COLLECTIONS}


def read_dev_seed_fixture(fixture_path: Path = DEFAULT_FIXTURE_PATH) -> dict[str, Any]:
    fixture = json.loads(fixture_path.read_text(encoding="utf-8"))
    _validate_fixture_shape(fixture)
    return fixture


def _validate_fixture_shape(fixture: dict[str, Any]) -> None:
    if fixture.get("version") != "dev-seed-v1":
        raise ValueError("dev seed fixture version must be dev-seed-v1")
    user = fixture.get("user")
    if not isinstance(user, dict) or user.get("id") != DEV_ADMIN_ID:
        raise ValueError("dev seed fixture must target the dev admin user")
    for collection in REQUIRED_COLLECTIONS:
        if not isinstance(fixture.get(collection), list) or not fixture[collection]:
            raise ValueError(f"dev seed fixture requires non-empty {collection}")
    risk_levels = {item.get("risk_level") for item in fixture["analysis_reports"]}
    if not {"normal", "caution", "high"}.issubset(risk_levels):
        raise ValueError("dev seed fixture must cover normal, caution, and high reports")
    statuses = {
        check.get("status")
        for report in fixture["analysis_reports"]
        for check in report.get("checklist", [])
    }
    if not {"pass", "fail", "unknown"}.issubset(statuses):
        raise ValueError("dev seed fixture must cover pass, fail, and unknown checklist states")


def _ensure_user_matches_admin(fixture: dict[str, Any]) -> None:
    for collection in ("watchlist_items", "analysis_reports", "qa_history"):
        for item in fixture[collection]:
            if item.get("user_id") != DEV_ADMIN_ID:
                raise ValueError(f"{collection} contains a non-admin seed row")
