from __future__ import annotations

import os
from typing import Any
from urllib.parse import urljoin

import requests

DEFAULT_AGENT_SERVICE_URL = "http://127.0.0.1:8787"
DEFAULT_TIMEOUT_SECONDS = 120.0


class AgentServiceError(RuntimeError):
    def __init__(
        self,
        code: str,
        message: str,
        *,
        status_code: int = 503,
        evidence: list[dict[str, Any]] | None = None,
    ) -> None:
        super().__init__(message)
        self.code = code
        self.message = message
        self.status_code = status_code
        self.evidence = evidence or []


def resolve_agent_service_url() -> str:
    return (
        os.getenv("AGENT_SERVICE_URL")
        or os.getenv("GONGSIRI_AGENT_URL")
        or DEFAULT_AGENT_SERVICE_URL
    ).rstrip("/")


class AgentServiceClient:
    def __init__(self, base_url: str | None = None, *, timeout: float = DEFAULT_TIMEOUT_SECONDS):
        self.base_url = (base_url or resolve_agent_service_url()).rstrip("/")
        self.timeout = timeout

    def generate_report(self, payload: dict[str, Any]) -> dict[str, Any]:
        return self._post_json("/report", payload)

    def answer_qa(self, payload: dict[str, Any]) -> dict[str, Any]:
        return self._post_json("/qa", payload)

    def explain_checklist(self, payload: dict[str, Any]) -> dict[str, Any]:
        return self._post_json("/checklist-explanation", payload)

    def _post_json(self, path: str, payload: dict[str, Any]) -> dict[str, Any]:
        url = urljoin(f"{self.base_url}/", path.lstrip("/"))
        try:
            response = requests.post(url, json=payload, timeout=self.timeout)
        except requests.RequestException as exc:
            raise AgentServiceError(
                "agent_unavailable",
                f"저 공시리가 공시리 응답 서비스에 연결하지 못했습니다: {exc}",
                status_code=503,
                evidence=[{"source": "agent_http", "url": self.base_url, "path": path}],
            ) from exc

        try:
            body = response.json()
        except ValueError as exc:
            raise AgentServiceError(
                "agent_malformed_response",
                "저 공시리가 공시리 응답 서비스에서 JSON 응답을 받지 못했습니다.",
                status_code=502,
                evidence=[
                    {
                        "source": "agent_http",
                        "url": self.base_url,
                        "path": path,
                        "statusCode": response.status_code,
                    }
                ],
            ) from exc

        if not isinstance(body, dict):
            raise AgentServiceError(
                "agent_malformed_response",
                "저 공시리가 공시리 응답을 JSON 객체로 해석하지 못했습니다.",
                status_code=502,
                evidence=[{"source": "agent_http", "url": self.base_url, "path": path}],
            )

        if response.status_code >= 400 or body.get("ok") is False:
            error = body.get("error") if isinstance(body.get("error"), dict) else {}
            code = str(error.get("code") or "agent_http_error")
            message = str(
                error.get("message")
                or (
                    "저 공시리가 공시리 응답 서비스에서 "
                    f"HTTP {response.status_code} 응답을 받았습니다."
                )
            )
            evidence = body.get("evidence") if isinstance(body.get("evidence"), list) else []
            raise AgentServiceError(
                code,
                message,
                status_code=response.status_code if response.status_code >= 400 else 502,
                evidence=evidence,
            )

        return body
