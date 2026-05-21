from __future__ import annotations

from fastapi.testclient import TestClient

from backend.main import app


def _success_envelope(*, trace_id: str = "route-trace", source: str = "user") -> dict:
    return {
        "ok": True,
        "triggerSource": source,
        "traceId": trace_id,
        "contractVersion": "v1",
        "observedAt": "2026-05-21T00:00:00Z",
        "result": {
            "normalized_data_bundle": {"company": {"corp_name": "카카오"}},
            "analysis_result": {
                "risk_score": 2,
                "risk_level": "caution",
                "checklist": [],
                "short_term_report": "short",
                "long_term_report": "long",
                "disclaimer": "투자 판단 참고용입니다.",
                "missing_evidence": [],
            },
            "preparation": {"persistence": {}, "notification": {}},
        },
        "evidence": [{"source": "stub_pipeline"}],
    }


def test_pipeline_trigger_empty_body_uses_route_level_default_evidence(monkeypatch):
    calls: list[dict] = []

    def fake_run_pipeline_request(request: dict, *, trace_id: str | None = None):
        calls.append(dict(request))
        return _success_envelope(trace_id=trace_id or "generated-trace", source=request["source"])

    monkeypatch.setattr(
        "backend.main.run_pipeline_request",
        fake_run_pipeline_request,
        raising=False,
    )

    response = TestClient(app).post("/pipeline/trigger")

    assert response.status_code == 200
    payload = response.json()
    assert payload["ok"] is True
    assert payload["triggerSource"] == "user"
    assert payload["traceId"]
    assert payload["contractVersion"] == "v1"
    assert payload["observedAt"]
    assert calls == [{"source": "user", "keyword": "카카오", "contractVersion": "v1"}]
    assert any(
        item.get("source") == "pipeline_trigger_route"
        and item.get("defaultUsed") is True
        and item.get("defaultKeyword") == "카카오"
        for item in payload["evidence"]
    )


def test_pipeline_trigger_explicit_keyword_wins_over_default(monkeypatch):
    calls: list[dict] = []

    def fake_run_pipeline_request(request: dict, *, trace_id: str | None = None):
        calls.append(dict(request))
        return _success_envelope(trace_id=trace_id or "keyword-trace", source=request["source"])

    monkeypatch.setattr(
        "backend.main.run_pipeline_request",
        fake_run_pipeline_request,
        raising=False,
    )

    response = TestClient(app).post(
        "/pipeline/trigger",
        json={"source": "cron", "keyword": "네이버", "traceId": "keyword-trace"},
    )

    assert response.status_code == 200
    payload = response.json()
    assert payload["ok"] is True
    assert payload["triggerSource"] == "cron"
    assert calls == [
        {"source": "cron", "keyword": "네이버", "traceId": "keyword-trace", "contractVersion": "v1"}
    ]
    assert not any(item.get("defaultUsed") is True for item in payload["evidence"])


def test_pipeline_trigger_explicit_corp_code_wins_over_default(monkeypatch):
    calls: list[dict] = []

    def fake_run_pipeline_request(request: dict, *, trace_id: str | None = None):
        calls.append(dict(request))
        return _success_envelope(trace_id=trace_id or "corp-trace", source=request["source"])

    monkeypatch.setattr(
        "backend.main.run_pipeline_request",
        fake_run_pipeline_request,
        raising=False,
    )

    response = TestClient(app).post(
        "/pipeline/trigger",
        json={"source": "system", "corpCode": "00258801", "traceId": "corp-trace"},
    )

    assert response.status_code == 200
    assert calls == [
        {
            "source": "system",
            "corpCode": "00258801",
            "traceId": "corp-trace",
            "contractVersion": "v1",
        }
    ]


def test_api_v1_reports_detail_returns_view_discriminated_contract(monkeypatch):
    calls: list[dict] = []

    def fake_run_pipeline_request(request: dict, *, trace_id: str | None = None):
        calls.append(dict(request))
        return _success_envelope(trace_id=trace_id or "report-trace", source=request["source"])

    monkeypatch.setattr(
        "backend.report_views.run_pipeline_request",
        fake_run_pipeline_request,
        raising=False,
    )
    monkeypatch.setattr(
        "backend.report_views.attach_agent_report",
        lambda response: {
            **response,
            "evidence": response["evidence"] + [{"source": "pi_agent_http"}],
        },
        raising=False,
    )

    response = TestClient(app).post(
        "/api/v1/reports", json={"view": "report-detail", "corpCode": "00258801"}
    )

    assert response.status_code == 200
    payload = response.json()
    assert payload["view"] == "report-detail"
    assert payload["report"]["corpCode"] == "00258801"
    assert payload["report"]["riskLevel"] == "caution"
    assert payload["fallback"] == {"used": True, "reason": "cold_start_generated_detail"}
    assert "ok" not in payload
    assert "result" not in payload
    assert calls == [{"source": "user", "contractVersion": "v1", "corpCode": "00258801"}]


def test_api_v1_reports_list_cold_start_returns_explicit_fallback():
    response = TestClient(app).post("/api/v1/reports", json={"view": "report-list"})

    assert response.status_code == 200
    payload = response.json()
    assert payload == {
        "view": "report-list",
        "reports": [],
        "fallback": {"used": True, "reason": "cold_start_no_cached_reports"},
    }


def test_api_v1_reports_manual_check_accepts_twenty_and_rejects_twenty_one():
    client = TestClient(app)
    accepted = client.post(
        "/api/v1/reports",
        json={"view": "manual-check", "corpCodes": [f"{index:08d}" for index in range(20)]},
    )
    rejected = client.post(
        "/api/v1/reports",
        json={"view": "manual-check", "corpCodes": [f"{index:08d}" for index in range(21)]},
    )

    assert accepted.status_code == 200
    assert accepted.json()["view"] == "manual-check"
    assert accepted.json()["maxBatchSize"] == 20
    assert accepted.json()["fallback"] == {"used": True, "reason": "read_only_manual_check"}
    assert rejected.status_code == 400
    assert rejected.json()["ok"] is False
    assert rejected.json()["error"]["code"] == "batch_limit_exceeded"


def test_api_v1_reports_requires_valid_view():
    response = TestClient(app).post("/api/v1/reports", json={"corpCode": "00258801"})

    assert response.status_code == 400
    payload = response.json()
    assert payload["ok"] is False
    assert payload["error"]["code"] == "invalid_request"


def test_pipeline_trigger_exception_maps_to_typed_failure(monkeypatch):
    def fake_run_pipeline_request(request: dict, *, trace_id: str | None = None):
        raise RuntimeError("route exploded")

    monkeypatch.setattr(
        "backend.main.run_pipeline_request",
        fake_run_pipeline_request,
        raising=False,
    )

    response = TestClient(app).post("/pipeline/trigger", json={"keyword": "카카오"})

    assert response.status_code == 200
    payload = response.json()
    assert payload["ok"] is False
    assert payload["error"]["code"] == "pipeline_trigger_failed"
    assert payload["error"]["message"] == "route exploded"
    assert payload["triggerSource"] == "user"
    assert payload["traceId"]


def test_qa_route_accepts_snake_case_corp_code(monkeypatch):
    calls: list[dict] = []

    def fake_build_runtime_normalized_bundle(*, keyword=None, corp_code=None):
        calls.append({"keyword": keyword, "corp_code": corp_code})
        return {"bundle": True}

    monkeypatch.setattr(
        "backend.main.build_runtime_normalized_bundle",
        fake_build_runtime_normalized_bundle,
        raising=False,
    )
    monkeypatch.setattr(
        "backend.main.analyze_bundle",
        lambda bundle: {"analysis": True},
        raising=False,
    )
    monkeypatch.setattr(
        "backend.main.answer_qa_with_agent",
        lambda *, question, bundle, analysis_result, trace_id, contract_version: {
            "answer": f"answer:{question}",
            "source": "pi_agent_http",
            "evidence": [{"source": "pi_agent_http"}],
        },
        raising=False,
    )

    response = TestClient(app).post(
        "/qa",
        json={"corp_code": "00258801", "question": "CB 발행의 영향은?"},
    )

    assert response.status_code == 200
    assert response.json()["answer"] == "answer:CB 발행의 영향은?"
    assert response.json()["source"] == "pi_agent_http"
    assert calls == [{"keyword": None, "corp_code": "00258801"}]


def test_qa_route_accepts_camel_case_corp_code(monkeypatch):
    calls: list[dict] = []

    def fake_build_runtime_normalized_bundle(*, keyword=None, corp_code=None):
        calls.append({"keyword": keyword, "corp_code": corp_code})
        return {"bundle": True}

    monkeypatch.setattr(
        "backend.main.build_runtime_normalized_bundle",
        fake_build_runtime_normalized_bundle,
        raising=False,
    )
    monkeypatch.setattr(
        "backend.main.analyze_bundle",
        lambda bundle: {"analysis": True},
        raising=False,
    )
    monkeypatch.setattr(
        "backend.main.answer_qa_with_agent",
        lambda *, question, bundle, analysis_result, trace_id, contract_version: {
            "answer": "ok",
            "source": "pi_agent_http",
            "evidence": [{"source": "pi_agent_http"}],
        },
        raising=False,
    )

    response = TestClient(app).post(
        "/qa",
        json={"corpCode": "00258801", "question": "최근 공시 요약해줘"},
    )

    assert response.status_code == 200
    assert response.json()["answer"] == "ok"
    assert response.json()["source"] == "pi_agent_http"
    assert calls == [{"keyword": None, "corp_code": "00258801"}]


def test_qa_route_accepts_keyword_when_corp_code_missing(monkeypatch):
    calls: list[dict] = []

    def fake_build_runtime_normalized_bundle(*, keyword=None, corp_code=None):
        calls.append({"keyword": keyword, "corp_code": corp_code})
        return {"bundle": True}

    monkeypatch.setattr(
        "backend.main.build_runtime_normalized_bundle",
        fake_build_runtime_normalized_bundle,
        raising=False,
    )
    monkeypatch.setattr(
        "backend.main.analyze_bundle",
        lambda bundle: {"analysis": True},
        raising=False,
    )
    monkeypatch.setattr(
        "backend.main.answer_qa_with_agent",
        lambda *, question, bundle, analysis_result, trace_id, contract_version: {
            "answer": "ok",
            "source": "pi_agent_http",
            "evidence": [{"source": "pi_agent_http"}],
        },
        raising=False,
    )

    response = TestClient(app).post(
        "/qa",
        json={"keyword": "카카오", "question": "최근 공시 요약해줘"},
    )

    assert response.status_code == 200
    assert response.json()["answer"] == "ok"
    assert response.json()["source"] == "pi_agent_http"
    assert calls == [{"keyword": "카카오", "corp_code": None}]


def test_qa_route_requires_question_and_identifier():
    client = TestClient(app)

    missing_question = client.post("/qa", json={"corpCode": "00258801"})
    assert missing_question.status_code == 400
    assert missing_question.json()["detail"] == "question은 비어 있을 수 없습니다."

    missing_identifier = client.post("/qa", json={"question": "질문"})
    assert missing_identifier.status_code == 400
    assert (
        missing_identifier.json()["detail"] == "corpCode 또는 keyword 중 하나는 반드시 필요합니다."
    )


def test_api_v1_reports_returns_typed_agent_failure_without_fallback(monkeypatch):
    from backend.agent_client import AgentServiceError

    monkeypatch.setattr(
        "backend.report_views.run_pipeline_request",
        lambda request, *, trace_id=None: _success_envelope(
            trace_id=trace_id or "agent-failure-trace",
            source=request["source"],
        ),
        raising=False,
    )

    def fake_attach_agent_report(response: dict):
        raise AgentServiceError(
            "agent_unavailable",
            "저 공시리가 agent service에 연결하지 못했습니다.",
            status_code=503,
            evidence=[{"source": "agent_http"}],
        )

    monkeypatch.setattr(
        "backend.report_views.attach_agent_report",
        fake_attach_agent_report,
        raising=False,
    )

    response = TestClient(app).post(
        "/api/v1/reports",
        json={"view": "report-detail", "corpCode": "00258801", "traceId": "agent-failure-trace"},
    )

    assert response.status_code == 503
    payload = response.json()
    assert payload["ok"] is False
    assert payload["traceId"] == "agent-failure-trace"
    assert payload["error"] == {
        "code": "agent_unavailable",
        "message": "저 공시리가 agent service에 연결하지 못했습니다.",
    }
    assert payload["evidence"] == [{"source": "agent_http"}]


def test_qa_route_returns_typed_agent_failure_without_solar_fallback(monkeypatch):
    from backend.agent_client import AgentServiceError

    monkeypatch.setattr(
        "backend.main.build_runtime_normalized_bundle",
        lambda *, keyword=None, corp_code=None: {"bundle": True},
        raising=False,
    )
    monkeypatch.setattr(
        "backend.main.analyze_bundle",
        lambda bundle: {"analysis": True},
        raising=False,
    )

    def fake_answer_qa_with_agent(**kwargs):
        raise AgentServiceError(
            "agent_unavailable",
            "저 공시리가 agent service에 연결하지 못했습니다.",
            status_code=503,
            evidence=[{"source": "agent_http"}],
        )

    monkeypatch.setattr(
        "backend.main.answer_qa_with_agent",
        fake_answer_qa_with_agent,
        raising=False,
    )

    response = TestClient(app).post(
        "/qa",
        json={"corpCode": "00258801", "question": "최근 공시 요약", "traceId": "qa-trace"},
    )

    assert response.status_code == 503
    payload = response.json()
    assert payload["ok"] is False
    assert payload["traceId"] == "qa-trace"
    assert payload["error"] == {
        "code": "agent_unavailable",
        "message": "저 공시리가 agent service에 연결하지 못했습니다.",
    }
    assert payload["evidence"] == [{"source": "agent_http"}]


def test_attach_agent_report_rejects_malformed_pi_success_without_report_text():
    from backend.agent_client import AgentServiceError
    from backend.agent_service import attach_agent_report

    class FakeAgentClient:
        def generate_report(self, payload: dict) -> dict:
            return {
                "ok": True,
                "traceId": "malformed-report-trace",
                "contractVersion": "v1",
                "evidence": [{"source": "fake_agent"}],
            }

    try:
        attach_agent_report(
            _success_envelope(trace_id="malformed-report-trace"), client=FakeAgentClient()
        )
    except AgentServiceError as exc:
        assert exc.code == "agent_malformed_response"
        assert "저 공시리가" in exc.message
        assert exc.status_code == 502
        assert any(item.get("endpoint") == "/report" for item in exc.evidence)
    else:
        raise AssertionError("malformed Pi report success must not fall back to deterministic text")
