from __future__ import annotations

import sqlite3

from backend.storage.sqlite_rows import (
    Row,
    columns,
    decode_json_fields,
    encode_json_fields,
    row_dict,
)


class SQLiteReportRepository:
    def __init__(self, connection: sqlite3.Connection) -> None:
        self.connection = connection

    def list_latest_for_user(self, user_id: str) -> list[Row]:
        rows = self.connection.execute(
            """
            SELECT r.* FROM analysis_reports r
            JOIN (
                SELECT corp_code, MAX(generated_at) AS generated_at
                FROM analysis_reports WHERE user_id = ? GROUP BY corp_code
            ) latest ON latest.corp_code = r.corp_code AND latest.generated_at = r.generated_at
            WHERE r.user_id = ? ORDER BY r.generated_at DESC
            """,
            (user_id, user_id),
        ).fetchall()
        return [_decode_report(row) for row in rows]

    def get_latest_detail(self, *, user_id: str, corp_code: str) -> Row | None:
        row = self.connection.execute(
            """
            SELECT * FROM analysis_reports
            WHERE user_id = ? AND corp_code = ?
            ORDER BY generated_at DESC LIMIT 1
            """,
            (user_id, corp_code),
        ).fetchone()
        return _decode_report(row) if row is not None else None

    def save_detail(self, report: Row) -> Row:
        encoded = encode_json_fields(
            report,
            ("checklist", "missing_evidence", "request_context", "source_timestamps"),
        )
        query = columns(encoded)
        self.connection.execute(
            f"""
            INSERT OR REPLACE INTO analysis_reports ({query.names})
            VALUES ({query.placeholders})
            """,
            query.values,
        )
        self.connection.commit()
        row = self.connection.execute(
            "SELECT * FROM analysis_reports WHERE id = ?", (report["id"],)
        )
        return _decode_report(row.fetchone())


class SQLiteQaHistoryRepository:
    def __init__(self, connection: sqlite3.Connection) -> None:
        self.connection = connection

    def list_for_user(self, *, user_id: str, corp_code: str | None = None) -> list[Row]:
        if corp_code:
            rows = self.connection.execute(
                """
                SELECT * FROM qa_history
                WHERE user_id = ? AND corp_code = ? ORDER BY asked_at DESC
                """,
                (user_id, corp_code),
            ).fetchall()
        else:
            rows = self.connection.execute(
                "SELECT * FROM qa_history WHERE user_id = ? ORDER BY asked_at DESC", (user_id,)
            ).fetchall()
        return [_decode_qa(row) for row in rows]

    def save_answer(self, item: Row) -> Row:
        encoded = encode_json_fields(item, ("evidence",))
        query = columns(encoded)
        self.connection.execute(
            f"INSERT OR REPLACE INTO qa_history ({query.names}) VALUES ({query.placeholders})",
            query.values,
        )
        self.connection.commit()
        row = self.connection.execute("SELECT * FROM qa_history WHERE id = ?", (item["id"],))
        return _decode_qa(row.fetchone())

    def list_recent_turns(self, *, user_id: str, corp_code: str, limit: int = 2) -> list[Row]:
        rows = self.connection.execute(
            """
            SELECT id, corp_code, corp_name, question, answer, evidence_json,
                   asked_at, source_version
            FROM qa_history WHERE user_id = ? AND corp_code = ?
            ORDER BY asked_at DESC LIMIT ?
            """,
            (user_id, corp_code, limit),
        ).fetchall()
        return [_decode_qa(row) for row in reversed(rows)]


class SQLiteAgentRunLogRepository:
    def __init__(self, connection: sqlite3.Connection) -> None:
        self.connection = connection

    def list_recent(self, *, user_id: str, limit: int = 20) -> list[Row]:
        rows = self.connection.execute(
            "SELECT * FROM agent_run_logs WHERE user_id = ? ORDER BY started_at DESC LIMIT ?",
            (user_id, limit),
        ).fetchall()
        return [row_dict(row) for row in rows]

    def save_run(self, run: Row) -> Row:
        encoded = encode_json_fields(run, ("error",))
        query = columns(encoded)
        self.connection.execute(
            f"INSERT OR REPLACE INTO agent_run_logs ({query.names}) VALUES ({query.placeholders})",
            query.values,
        )
        self.connection.commit()
        row = self.connection.execute("SELECT * FROM agent_run_logs WHERE id = ?", (run["id"],))
        return row_dict(row.fetchone())


def _decode_report(row: sqlite3.Row | None) -> Row:
    return decode_json_fields(
        row,
        {
            "checklist_json": "checklist",
            "missing_evidence_json": "missing_evidence",
            "request_context_json": "request_context",
            "source_timestamps_json": "source_timestamps",
        },
    )


def _decode_qa(row: sqlite3.Row | None) -> Row:
    return decode_json_fields(row, {"evidence_json": "evidence"})
