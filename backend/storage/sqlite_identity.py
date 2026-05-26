from __future__ import annotations

import sqlite3

from backend.storage.sqlite_rows import Row, columns, row_dict


class SQLiteUserRepository:
    def __init__(self, connection: sqlite3.Connection) -> None:
        self.connection = connection

    def get_by_username(self, username: str) -> Row | None:
        row = self.connection.execute(
            "SELECT * FROM users WHERE username = ?", (username,)
        ).fetchone()
        return row_dict(row) if row is not None else None

    def upsert_dev_user(self, user: Row) -> Row:
        query = columns(user)
        self.connection.execute(
            f"""
            INSERT INTO users ({query.names}) VALUES ({query.placeholders})
            ON CONFLICT(username) DO UPDATE SET {query.updates}
            """,
            query.values,
        )
        self.connection.commit()
        saved = self.get_by_username(str(user["username"]))
        if saved is None:
            raise RuntimeError("dev user 저장에 실패했습니다.")
        return saved


class SQLiteWatchlistRepository:
    def __init__(self, connection: sqlite3.Connection) -> None:
        self.connection = connection

    def list_for_user(self, user_id: str) -> list[Row]:
        rows = self.connection.execute(
            "SELECT * FROM watchlist_items WHERE user_id = ? ORDER BY added_at DESC", (user_id,)
        ).fetchall()
        return [row_dict(row) for row in rows]

    def upsert_item(self, item: Row) -> Row:
        query = columns(item)
        self.connection.execute(
            f"""
            INSERT INTO watchlist_items ({query.names}) VALUES ({query.placeholders})
            ON CONFLICT(user_id, corp_code) DO UPDATE SET {query.updates}
            """,
            query.values,
        )
        self.connection.commit()
        return self._get(str(item["user_id"]), str(item["corp_code"]))

    def update_last_checked(self, *, user_id: str, corp_code: str, last_checked: str) -> None:
        self.connection.execute(
            "UPDATE watchlist_items SET last_checked = ? WHERE user_id = ? AND corp_code = ?",
            (last_checked, user_id, corp_code),
        )
        self.connection.commit()

    def delete_item(self, *, user_id: str, corp_code: str) -> None:
        self.connection.execute(
            "DELETE FROM watchlist_items WHERE user_id = ? AND corp_code = ?", (user_id, corp_code)
        )
        self.connection.commit()

    def _get(self, user_id: str, corp_code: str) -> Row:
        row = self.connection.execute(
            "SELECT * FROM watchlist_items WHERE user_id = ? AND corp_code = ?",
            (user_id, corp_code),
        ).fetchone()
        if row is None:
            raise RuntimeError("watchlist item 저장에 실패했습니다.")
        return row_dict(row)


class SQLiteDisclosureCheckpointRepository:
    def __init__(self, connection: sqlite3.Connection) -> None:
        self.connection = connection

    def get(self, *, user_id: str, corp_code: str) -> Row | None:
        row = self.connection.execute(
            "SELECT * FROM disclosure_checkpoints WHERE user_id = ? AND corp_code = ?",
            (user_id, corp_code),
        ).fetchone()
        return row_dict(row) if row is not None else None

    def upsert(
        self, *, user_id: str, corp_code: str, last_seen_rcept_no: str, updated_at: str
    ) -> None:
        self.connection.execute(
            """
            INSERT INTO disclosure_checkpoints (user_id, corp_code, last_seen_rcept_no, updated_at)
            VALUES (?, ?, ?, ?)
            ON CONFLICT(user_id, corp_code) DO UPDATE SET
                last_seen_rcept_no = excluded.last_seen_rcept_no,
                updated_at = excluded.updated_at
            """,
            (user_id, corp_code, last_seen_rcept_no, updated_at),
        )
        self.connection.commit()


class SQLiteDisclosureRepository:
    def __init__(self, connection: sqlite3.Connection) -> None:
        self.connection = connection

    def list_recent(self, *, user_id: str, limit: int = 20) -> list[Row]:
        rows = self.connection.execute(
            """
            SELECT d.* FROM disclosures d
            JOIN watchlist_items w ON w.corp_code = d.corp_code
            WHERE w.user_id = ?
            ORDER BY d.rcept_dt DESC, d.observed_at DESC
            LIMIT ?
            """,
            (user_id, limit),
        ).fetchall()
        return [row_dict(row) for row in rows]

    def upsert_many(self, disclosures: list[Row]) -> None:
        for disclosure in disclosures:
            query = columns(disclosure)
            self.connection.execute(
                f"""
                INSERT INTO disclosures ({query.names}) VALUES ({query.placeholders})
                ON CONFLICT(rcept_no) DO UPDATE SET {query.updates}
                """,
                query.values,
            )
        self.connection.commit()
