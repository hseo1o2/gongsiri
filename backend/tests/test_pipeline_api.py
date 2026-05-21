from __future__ import annotations

from fastapi.testclient import TestClient

from backend.main import app

client = TestClient(app)


def _success_envelope() -> dict:
    return {
        "ok": True,
        "triggerSource": "user",
        "traceId": "trace",
        "contractVersion": "v1",
        "observedAt": "2026-05-21T00:00:00Z",
        "result": {
            "normalized_data_bundle": {"company": {"corp_code": "00258801"}},
            "analysis_result": {
                "risk_score": 2,
                "risk_level": "caution",
                "checklist": [],
                "short_term_report": "단기 리포트",
                "long_term_report": "장기 리포트",
                "disclaimer": "투자 참고용입니다.",
                "missing_evidence": [],
            },
            "preparation": {"persistence": {}, "notification": {}},
        },
        "evidence": [{"source": "analyzer", "riskScore": 2}],
    }


def test_empty_body_post_uses_route_default_and_appends_evidence(monkeypatch) -> None:
    calls: list[dict] = []

    def fake_run_pipeline_request(request: dict, *, trace_id: str | None = None) -> dict:
        calls.append({"request": request, "trace_id": trace_id})
        return _success_envelope()

    monkeypatch.setenv("GONGSIRI_DEFAULT_PIPELINE_KEYWORD", "삼성전자")
    monkeypatch.setattr("backend.main.run_pipeline_request", fake_run_pipeline_request)

    response = client.post("/pipeline/trigger")

    assert response.status_code == 200
    payload = response.json()
    assert payload["ok"] is True
    assert payload["triggerSource"] == "user"
    assert payload["traceId"]
    assert payload["contractVersion"] == "v1"
    assert payload["observedAt"]
    assert payload["result"]["analysis_result"]["risk_score"] == 2
    assert payload["result"]["analysis_result"]["risk_level"] == "caution"
    assert payload["result"]["analysis_result"]["checklist"] == []
    assert payload["result"]["analysis_result"]["short_term_report"]
    assert payload["result"]["analysis_result"]["long_term_report"]
    assert payload["result"]["analysis_result"]["disclaimer"]
    assert payload["result"]["analysis_result"]["missing_evidence"] == []
    assert calls == [{"request": {"source": "user", "metadata": {}, "keyword": "삼성전자"}, "trace_id": None}]
    assert payload["evidence"][-1] == {
        "source": "pipeline_trigger_route",
        "defaultUsed": True,
        "defaultKeyword": "삼성전자",
    }


def test_explicit_keyword_request_wins_over_default(monkeypatch) -> None:
    calls: list[dict] = []

    def fake_run_pipeline_request(request: dict, *, trace_id: str | None = None) -> dict:
        calls.append({"request": request, "trace_id": trace_id})
        return _success_envelope()

    monkeypatch.setattr("backend.main.run_pipeline_request", fake_run_pipeline_request)

    response = client.post(
        "/pipeline/trigger",
        json={"source": "system", "keyword": "카카오", "traceId": "trace-1"},
    )

    assert response.status_code == 200
    payload = response.json()
    assert payload["ok"] is True
    assert calls == [
        {
            "request": {"source": "system", "metadata": {}, "keyword": "카카오"},
            "trace_id": "trace-1",
        }
    ]
    assert not any(item.get("source") == "pipeline_trigger_route" for item in payload["evidence"])


def test_explicit_corp_code_request_wins_over_default(monkeypatch) -> None:
    calls: list[dict] = []

    def fake_run_pipeline_request(request: dict, *, trace_id: str | None = None) -> dict:
        calls.append({"request": request, "trace_id": trace_id})
        return _success_envelope()

    monkeypatch.setattr("backend.main.run_pipeline_request", fake_run_pipeline_request)

    response = client.post("/pipeline/trigger", json={"source": "cron", "corpCode": "00258801"})

    assert response.status_code == 200
    assert calls == [
        {
            "request": {"source": "cron", "metadata": {}, "corpCode": "00258801"},
            "trace_id": None,
        }
    ]


def test_pipeline_exception_maps_to_typed_failure_envelope(monkeypatch) -> None:
    def fake_run_pipeline_request(request: dict, *, trace_id: str | None = None) -> dict:
        return {
            "ok": False,
            "triggerSource": request["source"],
            "traceId": trace_id or "generated-trace",
            "contractVersion": "v1",
            "observedAt": "2026-05-21T00:00:00Z",
            "error": {"code": "analysis_failed", "message": "analysis exploded"},
            "evidence": [],
        }

    monkeypatch.setattr("backend.main.run_pipeline_request", fake_run_pipeline_request)

    response = client.post("/pipeline/trigger", json={"source": "cron", "keyword": "카카오"})

    assert response.status_code == 200
    payload = response.json()
    assert payload["ok"] is False
    assert payload["error"] == {"code": "analysis_failed", "message": "analysis exploded"}
    assert payload["triggerSource"] == "cron"


def test_malformed_json_maps_to_typed_failure() -> None:
    response = client.post(
        "/pipeline/trigger",
        content=b"not-json",
        headers={"content-type": "application/json"},
    )

    assert response.status_code == 200
    payload = response.json()
    assert payload["ok"] is False
    assert payload["error"]["code"] == "invalid_json"
