from __future__ import annotations

import argparse
import json
import sys
from datetime import UTC, datetime
from typing import Any

from backend.analyzer.pipeline import CONTRACT_VERSION
from backend.collector.bridge.disclosures import (
    InvalidRequestError,
    run_fetch_disclosures_request,
)


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="Read-only disclosure fetch bridge")
    parser.add_argument("--input", help="JSON request payload", default=None)
    parser.add_argument("--keyword", default=None)
    parser.add_argument("--corp-code", dest="corp_code", default=None)
    parser.add_argument("--bgn-de", dest="bgn_de", default=None)
    parser.add_argument("--end-de", dest="end_de", default=None)
    parser.add_argument("--page-count", dest="page_count", type=int, default=None)
    parser.add_argument("--trace-id", dest="trace_id", default=None)
    return parser


def _read_stdin() -> str:
    stream = sys.stdin
    is_tty = getattr(stream, "isatty", lambda: False)()
    if is_tty:
        return ""

    return stream.read().strip()


def _load_request(args: argparse.Namespace) -> dict[str, Any]:
    raw_payload = args.input or _read_stdin()
    payload: dict[str, Any] = {}

    if raw_payload:
        try:
            parsed = json.loads(raw_payload)
        except json.JSONDecodeError as exc:
            raise InvalidRequestError(f"입력 JSON 파싱에 실패했습니다: {exc.msg}") from exc

        if not isinstance(parsed, dict):
            raise InvalidRequestError("입력 payload는 JSON object여야 합니다.")

        payload = parsed

    overrides = {
        "keyword": args.keyword,
        "corpCode": args.corp_code,
        "bgnDe": args.bgn_de,
        "endDe": args.end_de,
        "pageCount": args.page_count,
    }

    for key, value in overrides.items():
        if value is not None:
            payload[key] = value

    return payload


def _observed_at() -> str:
    return datetime.now(UTC).isoformat().replace("+00:00", "Z")


def _invalid_request_response(trace_id: str, message: str) -> dict[str, Any]:
    return {
        "ok": False,
        "traceId": trace_id,
        "contractVersion": CONTRACT_VERSION,
        "observedAt": _observed_at(),
        "error": {
            "code": "invalid_request",
            "message": message,
        },
        "evidence": [],
    }


def main(argv: list[str] | None = None) -> int:
    parser = build_parser()
    args = parser.parse_args(argv)

    try:
        request = _load_request(args)
    except InvalidRequestError as exc:
        trace_id = args.trace_id or "invalid-request"
        response = _invalid_request_response(trace_id, str(exc))
        sys.stdout.write(json.dumps(response, ensure_ascii=False))
        sys.stdout.write("\n")
        return 1

    response = run_fetch_disclosures_request(
        request,
        trace_id=args.trace_id or request.get("traceId"),
    )
    sys.stdout.write(json.dumps(response, ensure_ascii=False))
    sys.stdout.write("\n")
    return 0 if response.get("ok") else 1


if __name__ == "__main__":
    raise SystemExit(main())
