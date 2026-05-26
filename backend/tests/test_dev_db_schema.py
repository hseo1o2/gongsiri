from __future__ import annotations

import sqlite3

from backend.storage.schema import (
    SCHEMA_VERSION,
    TABLES,
    create_schema,
    expected_index_names,
    fetch_index_names,
    fetch_table_names,
    reset_schema,
)


def test_dev_schema_creates_required_tables_and_indexes():
    connection = sqlite3.connect(":memory:")

    create_schema(connection)

    assert SCHEMA_VERSION == "dev-db-v2"
    assert fetch_table_names(connection) == set(TABLES)
    assert expected_index_names().issubset(fetch_index_names(connection))


def test_dev_schema_enforces_watchlist_user_corp_uniqueness():
    connection = sqlite3.connect(":memory:")
    create_schema(connection)
    connection.execute(
        """
        INSERT INTO users (id, username, password_secret, created_at, updated_at, source_version)
        VALUES ('admin', 'admin', 'admin', '2026-05-22T00:00:00Z', '2026-05-22T00:00:00Z', ?)
        """,
        (SCHEMA_VERSION,),
    )
    item = (
        "watch-kakao",
        "admin",
        "00258801",
        "카카오",
        "035720",
        "KOSPI",
        "2026-05-22T00:00:00Z",
        SCHEMA_VERSION,
    )

    connection.execute(
        """
        INSERT INTO watchlist_items
        (id, user_id, corp_code, corp_name, stock_code, market, added_at, source_version)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        """,
        item,
    )

    try:
        connection.execute(
            """
            INSERT INTO watchlist_items
            (id, user_id, corp_code, corp_name, stock_code, market, added_at, source_version)
            VALUES ('duplicate', ?, ?, ?, ?, ?, ?, ?)
            """,
            item[1:],
        )
    except sqlite3.IntegrityError:
        pass
    else:
        raise AssertionError("watchlist_items must be unique by user_id/corp_code")


def test_reset_schema_removes_rows_but_keeps_contract():
    connection = sqlite3.connect(":memory:")
    create_schema(connection)
    connection.execute(
        """
        INSERT INTO users (id, username, password_secret, created_at, updated_at, source_version)
        VALUES ('admin', 'admin', 'admin', '2026-05-22T00:00:00Z', '2026-05-22T00:00:00Z', ?)
        """,
        (SCHEMA_VERSION,),
    )

    reset_schema(connection)

    assert fetch_table_names(connection) == set(TABLES)
    assert connection.execute("SELECT COUNT(*) FROM users").fetchone()[0] == 0
