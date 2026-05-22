from __future__ import annotations

import sqlite3
from collections.abc import Sequence

SCHEMA_VERSION = "dev-db-v1"

TABLES: tuple[str, ...] = (
    "users",
    "watchlist_items",
    "disclosures",
    "analysis_reports",
    "qa_history",
    "agent_run_logs",
)

CREATE_STATEMENTS: tuple[str, ...] = (
    """
    CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        username TEXT NOT NULL UNIQUE,
        password_secret TEXT NOT NULL,
        role TEXT NOT NULL DEFAULT 'admin',
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        source_version TEXT NOT NULL
    )
    """,
    """
    CREATE TABLE IF NOT EXISTS watchlist_items (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        corp_code TEXT NOT NULL,
        corp_name TEXT NOT NULL,
        stock_code TEXT NOT NULL,
        market TEXT,
        added_at TEXT NOT NULL,
        source_version TEXT NOT NULL,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        UNIQUE (user_id, corp_code)
    )
    """,
    """
    CREATE TABLE IF NOT EXISTS disclosures (
        rcept_no TEXT PRIMARY KEY,
        corp_code TEXT NOT NULL,
        report_nm TEXT NOT NULL,
        rcept_dt TEXT NOT NULL,
        category TEXT,
        url TEXT,
        parsed_text TEXT,
        observed_at TEXT NOT NULL,
        source_version TEXT NOT NULL
    )
    """,
    """
    CREATE TABLE IF NOT EXISTS analysis_reports (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        corp_code TEXT NOT NULL,
        corp_name TEXT NOT NULL,
        risk_level TEXT NOT NULL CHECK (risk_level IN ('normal', 'caution', 'high')),
        risk_score INTEGER NOT NULL CHECK (risk_score >= 0),
        checklist_json TEXT NOT NULL,
        short_term_report TEXT NOT NULL,
        long_term_report TEXT NOT NULL,
        disclaimer TEXT NOT NULL,
        missing_evidence_json TEXT NOT NULL,
        request_context_json TEXT NOT NULL,
        source_timestamps_json TEXT NOT NULL,
        strict_pi_sdk INTEGER NOT NULL DEFAULT 1 CHECK (strict_pi_sdk IN (0, 1)),
        generated_at TEXT NOT NULL,
        source_version TEXT NOT NULL,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )
    """,
    """
    CREATE TABLE IF NOT EXISTS qa_history (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        corp_code TEXT NOT NULL,
        corp_name TEXT NOT NULL,
        question TEXT NOT NULL,
        answer TEXT NOT NULL,
        evidence_json TEXT NOT NULL,
        asked_at TEXT NOT NULL,
        source_version TEXT NOT NULL,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )
    """,
    """
    CREATE TABLE IF NOT EXISTS agent_run_logs (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        corp_code TEXT,
        trigger_source TEXT NOT NULL,
        status TEXT NOT NULL CHECK (status IN ('success', 'failure', 'running')),
        trace_id TEXT,
        started_at TEXT NOT NULL,
        completed_at TEXT,
        error_json TEXT,
        source_version TEXT NOT NULL,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )
    """,
)

INDEX_STATEMENTS: tuple[str, ...] = (
    "CREATE INDEX IF NOT EXISTS idx_watchlist_user ON watchlist_items(user_id)",
    "CREATE INDEX IF NOT EXISTS idx_watchlist_corp ON watchlist_items(corp_code)",
    "CREATE INDEX IF NOT EXISTS idx_disclosures_corp_date ON disclosures(corp_code, rcept_dt)",
    (
        "CREATE INDEX IF NOT EXISTS idx_reports_user_corp_generated "
        "ON analysis_reports(user_id, corp_code, generated_at DESC)"
    ),
    "CREATE INDEX IF NOT EXISTS idx_reports_generated ON analysis_reports(generated_at DESC)",
    (
        "CREATE INDEX IF NOT EXISTS idx_qa_user_corp_asked "
        "ON qa_history(user_id, corp_code, asked_at DESC)"
    ),
    (
        "CREATE INDEX IF NOT EXISTS idx_agent_runs_user_started "
        "ON agent_run_logs(user_id, started_at DESC)"
    ),
    "CREATE INDEX IF NOT EXISTS idx_agent_runs_trace ON agent_run_logs(trace_id)",
)


def create_schema(connection: sqlite3.Connection) -> None:
    connection.execute("PRAGMA foreign_keys = ON")
    for statement in (*CREATE_STATEMENTS, *INDEX_STATEMENTS):
        connection.execute(statement)
    connection.commit()


def reset_schema(connection: sqlite3.Connection) -> None:
    connection.execute("PRAGMA foreign_keys = OFF")
    for table in reversed(TABLES):
        connection.execute(f"DROP TABLE IF EXISTS {table}")
    connection.commit()
    create_schema(connection)


def fetch_table_names(connection: sqlite3.Connection) -> set[str]:
    rows = connection.execute(
        "SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%'"
    ).fetchall()
    return {str(row[0]) for row in rows}


def fetch_index_names(connection: sqlite3.Connection) -> set[str]:
    rows = connection.execute(
        "SELECT name FROM sqlite_master WHERE type = 'index' AND name NOT LIKE 'sqlite_%'"
    ).fetchall()
    return {str(row[0]) for row in rows}


def expected_index_names(statements: Sequence[str] = INDEX_STATEMENTS) -> set[str]:
    return {statement.split()[5] for statement in statements}
