from __future__ import annotations

import os

from fastapi.testclient import TestClient

from backend.main import app
from backend.storage.connection import get_repository_provider, reset_repository_provider
from backend.storage.seed import DEV_ADMIN_ID

os.environ["GONGSIRI_AUTH_MODE"] = "dev"


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
        "backend.routes.pipeline_routes.run_pipeline_request",
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


def test_report_and_qa_routes_require_dev_auth_mode(monkeypatch):
    monkeypatch.delenv("GONGSIRI_AUTH_MODE", raising=False)

    client = TestClient(app)
    report_response = client.post("/api/v1/reports", json={"view": "report-list"})
    qa_response = client.post("/qa", json={"corpCode": "00258801", "question": "질문"})

    assert report_response.status_code == 403
    assert report_response.json()["error"]["code"] == "dev_auth_disabled"
    assert qa_response.status_code == 403
    assert qa_response.json()["error"]["code"] == "dev_auth_disabled"


def test_pipeline_trigger_explicit_keyword_wins_over_default(monkeypatch):
    calls: list[dict] = []

    def fake_run_pipeline_request(request: dict, *, trace_id: str | None = None):
        calls.append(dict(request))
        return _success_envelope(trace_id=trace_id or "keyword-trace", source=request["source"])

    monkeypatch.setattr(
        "backend.routes.pipeline_routes.run_pipeline_request",
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
        "backend.routes.pipeline_routes.run_pipeline_request",
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
        "backend.report_runtime_builders.run_pipeline_request",
        fake_run_pipeline_request,
        raising=False,
    )
    monkeypatch.setattr(
        "backend.report_runtime_builders.attach_agent_report",
        lambda response: {
            **response,
            "evidence": response["evidence"] + [{"source": "pi_agent_http"}],
        },
        raising=False,
    )

    response = TestClient(app).post(
        "/api/v1/reports",
        json={"view": "report-detail", "corpCode": "00258801", "forceRefresh": True},
    )

    assert response.status_code == 200
    payload = response.json()
    assert payload["view"] == "report-detail"
    assert payload["report"]["corpCode"] == "00258801"
    assert payload["report"]["riskLevel"] == "caution"
    assert payload["fallback"] == {"used": False}
    assert "ok" not in payload
    assert "result" not in payload
    assert calls == [{"source": "user", "contractVersion": "v1", "corpCode": "00258801"}]


def test_api_v1_reports_detail_reads_saved_cache_before_generation(monkeypatch):
    reset_repository_provider()

    def fail_run_pipeline_request(*_args, **_kwargs):
        raise AssertionError("cached report detail should not regenerate before explicit refresh")

    monkeypatch.setattr(
        "backend.report_runtime_builders.run_pipeline_request",
        fail_run_pipeline_request,
        raising=False,
    )

    response = TestClient(app).post(
        "/api/v1/reports",
        json={"view": "report-detail", "corpCode": "00258801"},
    )

    assert response.status_code == 200
    payload = response.json()
    assert payload["view"] == "report-detail"
    assert payload["report"]["corpCode"] == "00258801"
    assert payload["fallback"] == {"used": False}
    reset_repository_provider()


def test_api_v1_reports_list_reads_saved_reports_from_dev_db():
    reset_repository_provider()
    response = TestClient(app).post("/api/v1/reports", json={"view": "report-list"})

    assert response.status_code == 200
    payload = response.json()
    assert payload["view"] == "report-list"
    assert payload["fallback"] == {"used": False}
    assert len(payload["reports"]) == 3
    assert {item["corpCode"] for item in payload["reports"]} == {"00258801", "00126380", "00999999"}
    reset_repository_provider()


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


def test_api_v1_reports_rejects_malformed_corp_code_without_pipeline(monkeypatch):
    def fail_run_pipeline_request(*_args, **_kwargs):
        raise AssertionError("malformed corpCode must fail before pipeline execution")

    monkeypatch.setattr(
        "backend.report_runtime_builders.run_pipeline_request",
        fail_run_pipeline_request,
        raising=False,
    )

    response = TestClient(app).post(
        "/api/v1/reports",
        json={"view": "report-detail", "corpCode": "../../etc/passwd"},
    )

    assert response.status_code == 400
    payload = response.json()
    assert payload["ok"] is False
    assert payload["error"]["code"] == "invalid_request"
    assert payload["error"]["message"] == "corpCode는 8자리 숫자 corpCode여야 합니다."


def test_pipeline_trigger_exception_maps_to_typed_failure(monkeypatch):
    def fake_run_pipeline_request(request: dict, *, trace_id: str | None = None):
        raise RuntimeError("route exploded")

    monkeypatch.setattr(
        "backend.routes.pipeline_routes.run_pipeline_request",
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
        "backend.routes.qa_routes.build_runtime_normalized_bundle",
        fake_build_runtime_normalized_bundle,
        raising=False,
    )
    monkeypatch.setattr(
        "backend.routes.qa_routes.analyze_bundle",
        lambda bundle: {"analysis": True},
        raising=False,
    )
    monkeypatch.setattr(
        "backend.routes.qa_routes.answer_qa_with_agent",
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
        "backend.routes.qa_routes.build_runtime_normalized_bundle",
        fake_build_runtime_normalized_bundle,
        raising=False,
    )
    monkeypatch.setattr(
        "backend.routes.qa_routes.analyze_bundle",
        lambda bundle: {"analysis": True},
        raising=False,
    )
    monkeypatch.setattr(
        "backend.routes.qa_routes.answer_qa_with_agent",
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
        "backend.routes.qa_routes.build_runtime_normalized_bundle",
        fake_build_runtime_normalized_bundle,
        raising=False,
    )
    monkeypatch.setattr(
        "backend.routes.qa_routes.analyze_bundle",
        lambda bundle: {"analysis": True},
        raising=False,
    )
    monkeypatch.setattr(
        "backend.routes.qa_routes.answer_qa_with_agent",
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
    assert missing_question.json()["ok"] is False
    assert missing_question.json()["error"]["code"] == "invalid_request"
    assert missing_question.json()["error"]["message"] == "question은 비어 있을 수 없습니다."

    missing_identifier = client.post("/qa", json={"question": "질문"})
    assert missing_identifier.status_code == 400
    assert missing_identifier.json()["ok"] is False
    assert missing_identifier.json()["error"]["code"] == "invalid_request"
    assert (
        missing_identifier.json()["error"]["message"]
        == "corpCode 또는 keyword 중 하나는 반드시 필요합니다."
    )


def test_qa_route_rejects_malformed_corp_code_without_agent_call(monkeypatch):
    def fail_build_runtime_normalized_bundle(**_kwargs):
        raise AssertionError("malformed corpCode must fail before bundle construction")

    monkeypatch.setattr(
        "backend.routes.qa_routes.build_runtime_normalized_bundle",
        fail_build_runtime_normalized_bundle,
        raising=False,
    )

    response = TestClient(app).post(
        "/qa",
        json={"corpCode": "../../etc/passwd", "question": "질문"},
    )

    assert response.status_code == 400
    assert response.json()["ok"] is False
    assert response.json()["error"]["code"] == "invalid_request"
    assert response.json()["error"]["message"] == "corpCode는 8자리 숫자 corpCode여야 합니다."


def test_api_v1_reports_returns_typed_agent_failure_without_fallback(monkeypatch):
    from backend.agent_client import AgentServiceError

    monkeypatch.setattr(
        "backend.report_runtime_views.run_pipeline_request",
        lambda request, *, trace_id=None: _success_envelope(
            trace_id=trace_id or "agent-failure-trace",
            source=request["source"],
        ),
        raising=False,
    )

    def fake_attach_agent_report(response: dict):
        raise AgentServiceError(
            "agent_unavailable",
            "저 공시리가 공시리 응답 서비스에 연결하지 못했습니다.",
            status_code=503,
            evidence=[{"source": "agent_http"}],
        )

    monkeypatch.setattr(
        "backend.report_runtime_builders.attach_agent_report",
        fake_attach_agent_report,
        raising=False,
    )

    response = TestClient(app).post(
        "/api/v1/reports",
        json={
            "view": "report-detail",
            "corpCode": "00258801",
            "traceId": "agent-failure-trace",
            "forceRefresh": True,
        },
    )

    assert response.status_code == 503
    payload = response.json()
    assert payload["ok"] is False
    assert payload["traceId"] == "agent-failure-trace"
    assert payload["error"] == {
        "code": "agent_unavailable",
        "message": "저 공시리가 공시리 응답 서비스에 연결하지 못했습니다.",
    }
    assert payload["evidence"] == [{"source": "agent_http"}]


def test_qa_route_returns_typed_agent_failure_without_solar_fallback(monkeypatch):
    from backend.agent_client import AgentServiceError

    monkeypatch.setattr(
        "backend.routes.qa_routes.build_runtime_normalized_bundle",
        lambda *, keyword=None, corp_code=None: {"bundle": True},
        raising=False,
    )
    monkeypatch.setattr(
        "backend.routes.qa_routes.analyze_bundle",
        lambda bundle: {"analysis": True},
        raising=False,
    )

    def fake_answer_qa_with_agent(**kwargs):
        raise AgentServiceError(
            "agent_unavailable",
            "저 공시리가 공시리 응답 서비스에 연결하지 못했습니다.",
            status_code=503,
            evidence=[{"source": "agent_http"}],
        )

    monkeypatch.setattr(
        "backend.routes.qa_routes.answer_qa_with_agent",
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
        "message": "저 공시리가 공시리 응답 서비스에 연결하지 못했습니다.",
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


def test_attach_agent_report_merges_checklist_explanations_from_agent():
    from backend.agent_service import attach_agent_report

    class FakeAgentClient:
        def generate_report(self, payload: dict) -> dict:
            return {
                "ok": True,
                "mode": "report",
                "traceId": "explain-trace",
                "contractVersion": "v1",
                "observedAt": "2026-05-22T00:00:00Z",
                "markdown": "## 단기\nshort",
                "text": "## 단기\nshort",
                "warnings": [],
                "data": {
                    "report": {
                        "shortTermMarkdown": "## 단기\nshort",
                        "longTermMarkdown": "",
                        "disclaimerMarkdown": "공시 기반 위험 점검입니다.",
                    },
                    "analysisGuard": {
                        "riskScore": 2,
                        "riskLevel": "caution",
                        "checklistIds": ["business-purpose-change"],
                    },
                },
                "evidence": [{"source": "fake_agent"}],
            }

        def explain_checklist(self, payload: dict) -> dict:
            return {
                "ok": True,
                "mode": "checklist_explanation",
                "traceId": "explain-trace",
                "contractVersion": "v1",
                "observedAt": "2026-05-22T00:00:00Z",
                "markdown": "체크리스트 설명",
                "text": "체크리스트 설명",
                "warnings": [],
                "data": {
                    "checklistExplanation": {
                        "summaryMarkdown": "체크리스트 설명",
                        "items": [
                            {
                                "id": "business-purpose-change",
                                "markdown": (
                                    "저 공시리가 보기에는 사업목적 변경 공시를 "
                                    "확인해야 합니다."
                                ),
                            }
                        ],
                    },
                    "analysisGuard": {
                        "riskScore": 2,
                        "riskLevel": "caution",
                        "checklistIds": ["business-purpose-change"],
                    },
                },
                "evidence": [{"source": "fake_agent"}],
            }

    response = attach_agent_report(
        {
            **_success_envelope(trace_id="explain-trace"),
            "result": {
                **_success_envelope(trace_id="explain-trace")["result"],
                "analysis_result": {
                    **_success_envelope(trace_id="explain-trace")["result"]["analysis_result"],
                    "checklist": [
                        {
                            "id": "business-purpose-change",
                            "reason": "원래 이유",
                            "title": "사업목적 전환 이력",
                            "status": "fail",
                            "score": 1,
                            "evidence": [],
                        }
                    ],
                },
            },
        },
        client=FakeAgentClient(),
    )

    assert response["result"]["analysis_result"]["checklist"][0]["solar_explanation"].startswith(
        "저 공시리가"
    )


def test_attach_agent_report_accepts_structured_mode_contract_and_preserves_guard():
    from backend.agent_service import attach_agent_report

    class FakeAgentClient:
        def generate_report(self, payload: dict) -> dict:
            return {
                "ok": True,
                "mode": "report",
                "traceId": "structured-report-trace",
                "contractVersion": "v1",
                "observedAt": "2026-05-22T00:00:00Z",
                "markdown": "## 단기\nshort\n\n## 장기\nlong",
                "text": "## 단기\nshort\n\n## 장기\nlong",
                "warnings": [],
                "data": {
                    "report": {
                        "shortTermMarkdown": "## 단기\nshort",
                        "longTermMarkdown": "## 장기\nlong",
                        "disclaimerMarkdown": "공시 기반 위험 점검입니다.",
                    },
                    "analysisGuard": {
                        "riskScore": 2,
                        "riskLevel": "caution",
                        "checklistIds": [],
                    },
                },
                "evidence": [{"source": "fake_agent"}],
            }

    response = attach_agent_report(
        _success_envelope(trace_id="structured-report-trace"), client=FakeAgentClient()
    )

    assert (
        response["result"]["analysis_result"]["short_term_report"]
        == "## 단기\nshort"
    )
    assert (
        response["result"]["analysis_result"]["long_term_report"]
        == "## 장기\nlong"
    )
    assert response["result"]["analysis_result"]["disclaimer"] == "공시 기반 위험 점검입니다."


def test_answer_qa_with_agent_accepts_structured_mode_contract():
    from backend.agent_service import answer_qa_with_agent

    class FakeAgentClient:
        def answer_qa(self, payload: dict) -> dict:
            return {
                "ok": True,
                "mode": "qa",
                "traceId": "structured-qa-trace",
                "contractVersion": "v1",
                "observedAt": "2026-05-22T00:00:00Z",
                "markdown": "저 공시리가 보기에는 CB 공시를 함께 확인해야 합니다.",
                "text": "저 공시리가 보기에는 CB 공시를 함께 확인해야 합니다.",
                "warnings": [],
                "data": {
                    "qa": {
                        "answerMarkdown": "저 공시리가 보기에는 CB 공시를 함께 확인해야 합니다."
                    },
                    "analysisGuard": {
                        "riskScore": 2,
                        "riskLevel": "caution",
                        "checklistIds": [],
                    },
                },
                "evidence": [{"source": "fake_agent"}],
            }

    result = answer_qa_with_agent(
        question="CB 공시 영향은?",
        bundle={"company": {"corp_name": "카카오"}},
        analysis_result={"risk_score": 2, "risk_level": "caution", "checklist": []},
        trace_id="structured-qa-trace",
        contract_version="v1",
        client=FakeAgentClient(),
    )

    assert "저 공시리가" in result["answer"]
    assert result["source"] == "pi_agent_http"


def test_explain_checklist_with_agent_returns_structured_items():
    from backend.agent_service import explain_checklist_with_agent

    class FakeAgentClient:
        def explain_checklist(self, payload: dict) -> dict:
            return {
                "ok": True,
                "mode": "checklist_explanation",
                "traceId": "checklist-trace",
                "contractVersion": "v1",
                "observedAt": "2026-05-22T00:00:00Z",
                "markdown": "체크리스트 설명 요약",
                "text": "체크리스트 설명 요약",
                "warnings": [],
                "data": {
                    "checklistExplanation": {
                        "summaryMarkdown": "체크리스트 설명 요약",
                        "items": [
                            {
                                "id": "business-purpose-change",
                                "markdown": (
                                    "저 공시리가 보기에는 사업목적 변경 공시를 "
                                    "확인해야 합니다."
                                ),
                            }
                        ],
                    },
                    "analysisGuard": {
                        "riskScore": 2,
                        "riskLevel": "caution",
                        "checklistIds": ["business-purpose-change"],
                    },
                },
                "evidence": [{"source": "fake_agent"}],
            }

    result = explain_checklist_with_agent(
        bundle={"company": {"corp_name": "카카오"}},
        analysis_result={
            "risk_score": 2,
            "risk_level": "caution",
            "checklist": [{"id": "business-purpose-change"}],
        },
        trace_id="checklist-trace",
        contract_version="v1",
        checklist_ids=["business-purpose-change"],
        client=FakeAgentClient(),
    )

    assert result["items"][0]["id"] == "business-purpose-change"
    assert "저 공시리가" in result["items"][0]["markdown"]


def test_api_v1_reports_detail_pipeline_failure_matches_typed_error_contract(monkeypatch):
    def fake_run_pipeline_request(request: dict, *, trace_id: str | None = None):
        return {
            "ok": False,
            "triggerSource": request["source"],
            "traceId": trace_id or "pipeline-failure-trace",
            "contractVersion": "v1",
            "observedAt": "2026-05-21T00:00:00Z",
            "error": {"code": "corp_code_unresolved", "message": "corp code를 확인할 수 없습니다."},
            "evidence": [],
        }

    monkeypatch.setattr(
        "backend.report_runtime_builders.run_pipeline_request",
        fake_run_pipeline_request,
        raising=False,
    )

    response = TestClient(app).post(
        "/api/v1/reports",
        json={"view": "report-detail", "corpCode": "99999999", "traceId": "pipeline-failure-trace"},
    )

    assert response.status_code == 400
    payload = response.json()
    assert payload["ok"] is False
    assert payload["triggerSource"] == "user"
    assert payload["error"]["code"] == "corp_code_unresolved"


def test_api_v1_reports_list_does_not_fabricate_summaries_without_persistence():
    response = TestClient(app).post(
        "/api/v1/reports",
        json={"view": "report-list", "corpCodes": ["12345678"]},
    )

    assert response.status_code == 200
    assert response.json() == {
        "view": "report-list",
        "reports": [],
        "fallback": {"used": True, "reason": "cold_start_no_cached_reports"},
    }


def test_qa_route_persists_saved_answer_and_history_route_filters_by_corp_code(monkeypatch):
    monkeypatch.setenv("GONGSIRI_AUTH_MODE", "dev")
    reset_repository_provider()

    monkeypatch.setattr(
        "backend.routes.qa_routes.build_runtime_normalized_bundle",
        lambda *, keyword=None, corp_code=None: {
            "company": {"corp_name": "카카오", "corp_code": corp_code or "00258801"}
        },
        raising=False,
    )
    monkeypatch.setattr(
        "backend.routes.qa_routes.analyze_bundle",
        lambda bundle: {"analysis": True},
        raising=False,
    )
    monkeypatch.setattr(
        "backend.routes.qa_routes.answer_qa_with_agent",
        lambda **kwargs: {
            "answer": "저 공시리가 저장 가능한 답변을 만들었습니다.",
            "source": "pi_agent_http",
            "evidence": [{"source": "pi_agent_http"}],
        },
        raising=False,
    )

    client = TestClient(app)
    created = client.post("/qa", json={"corpCode": "00258801", "question": "새 질문"})
    history = client.get("/api/v1/qa-history?corp_code=00258801")

    assert created.status_code == 200
    assert history.status_code == 200
    body = history.json()
    assert body["ok"] is True
    assert body["items"][0]["corpCode"] == "00258801"
    assert body["items"][0]["corpName"] == "카카오"
    assert body["items"][0]["question"] == "새 질문"
    assert "저 공시리가" in body["items"][0]["answer"]
    reset_repository_provider()


def test_qa_route_agent_failure_does_not_store_success_row(monkeypatch):
    from backend.agent_client import AgentServiceError

    monkeypatch.setenv("GONGSIRI_AUTH_MODE", "dev")
    reset_repository_provider()
    before = len(
        get_repository_provider().qa_history.list_for_user(
            user_id=DEV_ADMIN_ID, corp_code="00258801"
        )
    )

    monkeypatch.setattr(
        "backend.routes.qa_routes.build_runtime_normalized_bundle",
        lambda *, keyword=None, corp_code=None: {
            "company": {"corp_name": "카카오", "corp_code": corp_code or "00258801"}
        },
        raising=False,
    )
    monkeypatch.setattr(
        "backend.routes.qa_routes.analyze_bundle",
        lambda bundle: {"analysis": True},
        raising=False,
    )

    def fake_answer_qa_with_agent(**kwargs):
        raise AgentServiceError(
            "agent_unavailable",
            "저 공시리가 공시리 응답 서비스에 연결하지 못했습니다.",
            status_code=503,
            evidence=[{"source": "agent_http"}],
        )

    monkeypatch.setattr(
        "backend.routes.qa_routes.answer_qa_with_agent",
        fake_answer_qa_with_agent,
        raising=False,
    )

    response = TestClient(app).post(
        "/qa", json={"corpCode": "00258801", "question": "저장되면 안 됨"}
    )
    after = len(
        get_repository_provider().qa_history.list_for_user(
            user_id=DEV_ADMIN_ID, corp_code="00258801"
        )
    )

    assert response.status_code == 503
    assert after == before
    reset_repository_provider()
