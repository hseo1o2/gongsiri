from __future__ import annotations

import json
import sqlite3
from typing import Any

from backend.storage.sqlite_rows import Row, row_dict


class SQLiteReportCacheRepository:
    def __init__(self, connection: sqlite3.Connection) -> None:
        self.connection = connection

    def get(self, *, user_id: str, corp_code: str) -> dict[str, Any] | None:
        row = self.connection.execute(
            "SELECT * FROM report_cache WHERE user_id = ? AND corp_code = ?",
            (user_id, corp_code),
        ).fetchone()
        if row is None:
            return None
        r: Row = row_dict(row)
        try:
            return json.loads(str(r["payload_json"]))
        except Exception:
            return None

    def upsert(
        self, *, user_id: str, corp_code: str, generated_at: str, payload: dict[str, Any]
    ) -> None:
        self.connection.execute(
            """
            INSERT INTO report_cache (user_id, corp_code, generated_at, payload_json)
            VALUES (?, ?, ?, ?)
            ON CONFLICT(user_id, corp_code) DO UPDATE SET
                generated_at = excluded.generated_at,
                payload_json = excluded.payload_json
            """,
            (user_id, corp_code, generated_at, json.dumps(payload, ensure_ascii=False)),
        )
        self.connection.commit()
