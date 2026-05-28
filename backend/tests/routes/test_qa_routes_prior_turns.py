"""
Tests for qa_routes prior_turns behaviour and SQLiteQaHistoryRepository.list_recent_turns.

Uses a real SQLiteQaHistoryRepository backed by an in-memory SQLite connection
(no Mock Protocol). The integration test for POST /qa uses FastAPI TestClient
with the full app and mocks only answer_qa_with_agent + the heavy upstream
I/O (build_runtime_normalized_bundle, analyze_bundle).
"""

from __future__ import annotations

import sqlite3
from typing import Any
from unittest.mock import patch

import pytest
from fastapi.testclient import TestClient

from backend.storage.schema import SCHEMA_VERSION, create_schema
from backend.storage.seed import DEV_ADMIN_ID, seed_dev_admin
from backend.storage.sqlite_analysis import SQLiteQaHistoryRepository

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _make_connection() -> sqlite3.Connection:
    conn = sqlite3.connect(":memory:", check_same_thread=False)
    conn.row_factory = sqlite3.Row
    create_schema(conn)
    seed_dev_admin(conn)
    return conn


def _qa_row(conn: sqlite3.Connection, *, idx: int, asked_at: str) -> dict[str, Any]:
    return {
        "id": f"qa-test-{idx}",
        "user_id": DEV_ADMIN_ID,
        "corp_code": "00258801",
        "corp_name": "카카오",
        "question": f"질문 {idx}",
        "answer": f"답변 {idx}",
        "evidence": [],
        "asked_at": asked_at,
        "source_version": SCHEMA_VERSION,
    }


# ---------------------------------------------------------------------------
# Unit tests — SQLiteQaHistoryRepository.list_recent_turns
# ---------------------------------------------------------------------------


class TestListRecentTurns:
    def test_returns_two_oldest_in_asc_order(self):
        conn = _make_connection()
        repo = SQLiteQaHistoryRepository(conn)

        # Insert 3 rows with distinct timestamps
        rows = [
            _qa_row(conn, idx=1, asked_at="2026-05-01T10:00:00Z"),
            _qa_row(conn, idx=2, asked_at="2026-05-02T10:00:00Z"),
            _qa_row(conn, idx=3, asked_at="2026-05-03T10:00:00Z"),
        ]
        for row in rows:
            repo.save_answer(row)

        result = repo.list_recent_turns(
            user_id=DEV_ADMIN_ID,
            corp_code="00258801",
            limit=2,
        )

        assert len(result) == 2, f"expected 2 turns, got {len(result)}"
        # Should be ASC order (oldest first among the 2 most-recent)
        # list_recent_turns: DESC LIMIT 2 → [row3, row2], then reversed → [row2, row3]
        q0, q1 = result[0]["question"], result[1]["question"]
        assert q0 == "질문 2", f"first turn should be 질문 2, got {q0}"
        assert q1 == "질문 3", f"second turn should be 질문 3, got {q1}"

    def test_returns_empty_list_when_no_history(self):
        conn = _make_connection()
        repo = SQLiteQaHistoryRepository(conn)

        result = repo.list_recent_turns(
            user_id=DEV_ADMIN_ID,
            corp_code="99999999",
            limit=2,
        )
        assert result == []

    def test_limit_respected_when_fewer_rows_exist(self):
        conn = _make_connection()
        repo = SQLiteQaHistoryRepository(conn)

        repo.save_answer(_qa_row(conn, idx=1, asked_at="2026-05-01T10:00:00Z"))

        result = repo.list_recent_turns(
            user_id=DEV_ADMIN_ID,
            corp_code="00258801",
            limit=2,
        )
        assert len(result) == 1

    def test_isolates_by_corp_code(self):
        conn = _make_connection()
        repo = SQLiteQaHistoryRepository(conn)

        other_row = {
            **_qa_row(conn, idx=1, asked_at="2026-05-01T10:00:00Z"),
            "id": "qa-other-1",
            "corp_code": "00000001",
            "corp_name": "다른회사",
        }
        repo.save_answer(other_row)

        result = repo.list_recent_turns(
            user_id=DEV_ADMIN_ID,
            corp_code="00258801",
            limit=2,
        )
        assert result == [], "should not return rows for a different corp_code"


# ---------------------------------------------------------------------------
# Integration test — POST /qa passes conversation_key and prior_turns
# ---------------------------------------------------------------------------


def _stub_bundle():
    """Minimal bundle-like object answer_qa_with_agent accepts."""

    class _Bundle:
        def model_dump(self):
            return {
                "company": {
                    "corp_code": "00258801",
                    "corp_name": "카카오",
                },
            }

    return _Bundle()


def _stub_analysis():
    class _Analysis:
        def model_dump(self):
            return {
                "risk_score": 0,
                "risk_level": "normal",
                "checklist": [],
                "short_term_report": "",
                "long_term_report": "",
                "disclaimer": "",
                "missing_evidence": [],
            }

    return _Analysis()


class TestQaRoutePassesPriorTurns:
    @pytest.fixture()
    def memory_provider(self, monkeypatch):
        """Isolate the repository provider to an in-memory database."""
        from backend.storage import connection as conn_module
        from backend.storage.sqlite_repositories import SQLiteRepositoryProvider

        db_conn = _make_connection()
        provider = SQLiteRepositoryProvider(db_conn)
        monkeypatch.setattr(conn_module, "_provider", provider)
        monkeypatch.setattr(conn_module, "_connection", db_conn)
        yield provider
        db_conn.close()
        monkeypatch.setattr(conn_module, "_provider", None)
        monkeypatch.setattr(conn_module, "_connection", None)

    @pytest.fixture()
    def client(self, memory_provider, monkeypatch):
        monkeypatch.setenv("GONGSIRI_DEV_AUTH", "true")
        from backend.main import app

        return TestClient(app, raise_server_exceptions=True)

    def test_post_qa_sends_conversation_key_and_prior_turns(
        self, client, memory_provider, monkeypatch
    ):
        # Pre-insert 2 qa_history rows so prior_turns will be non-empty
        repo = memory_provider.qa_history
        repo.save_answer(_qa_row(None, idx=1, asked_at="2026-05-01T10:00:00Z"))
        repo.save_answer(_qa_row(None, idx=2, asked_at="2026-05-02T10:00:00Z"))

        captured: dict[str, Any] = {}

        def spy_answer_qa(
            *,
            question,
            bundle,
            analysis_result,
            trace_id,
            contract_version,
            conversation_key=None,
            prior_turns=None,
            client=None,
        ):
            captured["conversation_key"] = conversation_key
            captured["prior_turns"] = prior_turns
            return {
                "answer": "저 공시리가 확인한 답변입니다.",
                "source": "pi_agent_http",
                "evidence": [],
            }

        with (
            patch(
                "backend.routes.qa_routes.build_runtime_normalized_bundle",
                return_value=_stub_bundle(),
            ),
            patch(
                "backend.routes.qa_routes.analyze_bundle",
                return_value=_stub_analysis(),
            ),
            patch(
                "backend.routes.qa_routes.answer_qa_with_agent",
                side_effect=spy_answer_qa,
            ),
            patch(
                "backend.routes.qa_routes._save_qa_history_row",
                return_value={},
            ),
        ):
            resp = client.post(
                "/qa",
                json={
                    "question": "카카오 최근 공시 요약?",
                    "corpCode": "00258801",
                },
            )

        assert resp.status_code == 200, f"expected 200, got {resp.status_code}: {resp.text}"

        # conversation_key must be a non-empty string in "${user_id}::${corp_code}" format
        assert captured.get("conversation_key") is not None, "conversation_key should be set"
        conv_key = captured["conversation_key"]
        assert isinstance(conv_key, str) and "::" in conv_key, (
            f"conversation_key should be 'user_id::corp_code' string, got: {conv_key!r}"
        )
        assert conv_key.endswith("::00258801"), f"wrong corpCode in conversation_key: {conv_key}"

        # prior_turns should contain 4 items: 2 turns × {role:user, role:assistant}
        prior = captured.get("prior_turns")
        assert prior is not None, "prior_turns should be set"
        assert len(prior) == 4, (
            f"expected 4 prior_turn items (2 turns × user+assistant), got {len(prior)}"
        )
        assert prior[0]["role"] == "user"
        assert prior[1]["role"] == "assistant"
        assert prior[2]["role"] == "user"
        assert prior[3]["role"] == "assistant"
        # ASC order: 질문 1 before 질문 2
        c0, c2 = prior[0]["content"], prior[2]["content"]
        assert "질문 1" in c0, f"first turn should be 질문 1, got {c0}"
        assert "질문 2" in c2, f"second turn should be 질문 2, got {c2}"
