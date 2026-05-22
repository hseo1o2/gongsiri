from __future__ import annotations

import sqlite3

from backend.storage.sqlite_analysis import (
    SQLiteAgentRunLogRepository,
    SQLiteQaHistoryRepository,
    SQLiteReportRepository,
)
from backend.storage.sqlite_identity import (
    SQLiteDisclosureRepository,
    SQLiteUserRepository,
    SQLiteWatchlistRepository,
)


class SQLiteRepositoryProvider:
    def __init__(self, connection: sqlite3.Connection) -> None:
        self.users = SQLiteUserRepository(connection)
        self.watchlist = SQLiteWatchlistRepository(connection)
        self.disclosures = SQLiteDisclosureRepository(connection)
        self.reports = SQLiteReportRepository(connection)
        self.qa_history = SQLiteQaHistoryRepository(connection)
        self.agent_run_logs = SQLiteAgentRunLogRepository(connection)
