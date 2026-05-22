from __future__ import annotations

import os
import sqlite3
from pathlib import Path

from backend.storage.fixture_loader import load_dev_seed_fixture
from backend.storage.schema import create_schema
from backend.storage.seed import seed_dev_admin
from backend.storage.sqlite_repositories import SQLiteRepositoryProvider

MEMORY_MODE = "memory"
FILE_MODE = "file"
DEFAULT_FILE_PATH = Path("data/dev.sqlite")

_provider: SQLiteRepositoryProvider | None = None
_connection: sqlite3.Connection | None = None


def connect_dev_db(*, mode: str | None = None, path: str | None = None) -> sqlite3.Connection:
    resolved_mode = (mode or os.getenv("GONGSIRI_DB_MODE") or MEMORY_MODE).strip().lower()
    if resolved_mode not in {MEMORY_MODE, FILE_MODE}:
        raise ValueError("GONGSIRI_DB_MODE은 memory 또는 file이어야 합니다.")

    database = _database_target(resolved_mode, path or os.getenv("GONGSIRI_DB_PATH"))
    connection = sqlite3.connect(database, check_same_thread=False)
    connection.row_factory = sqlite3.Row
    create_schema(connection)
    seed_dev_admin(connection)
    load_dev_seed_fixture(connection)
    return connection


def get_repository_provider() -> SQLiteRepositoryProvider:
    global _connection, _provider
    if _provider is None:
        _connection = connect_dev_db()
        _provider = SQLiteRepositoryProvider(_connection)
    return _provider


def reset_repository_provider() -> None:
    global _connection, _provider
    if _connection is not None:
        _connection.close()
    _connection = None
    _provider = None


def _database_target(mode: str, path: str | None) -> str:
    if mode == MEMORY_MODE:
        return ":memory:"
    db_path = Path(path) if path else DEFAULT_FILE_PATH
    db_path.parent.mkdir(parents=True, exist_ok=True)
    return str(db_path)
