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
