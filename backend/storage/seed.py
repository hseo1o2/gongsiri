from __future__ import annotations

import sqlite3
from datetime import UTC, datetime

from backend.storage.schema import SCHEMA_VERSION

DEV_ADMIN_ID = "dev-admin"
DEV_ADMIN_USERNAME = "admin"
DEV_ADMIN_PASSWORD = "admin"


def seed_dev_admin(connection: sqlite3.Connection) -> None:
    now = datetime.now(UTC).isoformat().replace("+00:00", "Z")
    connection.execute(
        """
        INSERT INTO users (
            id, username, password_secret, role, created_at, updated_at, source_version
        )
        VALUES (?, ?, ?, 'admin', ?, ?, ?)
        ON CONFLICT(username) DO UPDATE SET
            password_secret = excluded.password_secret,
            role = excluded.role,
            updated_at = excluded.updated_at,
            source_version = excluded.source_version
        """,
        (DEV_ADMIN_ID, DEV_ADMIN_USERNAME, DEV_ADMIN_PASSWORD, now, now, SCHEMA_VERSION),
    )
    connection.commit()
