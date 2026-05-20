from __future__ import annotations

import argparse
import json
import sys
from typing import Any

from backend.analyzer.pipeline import run_pipeline_request


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="Normalize -> analyze pipeline bridge")
    parser.add_argument("--input", help="JSON request payload", default=None)
    parser.add_argument("--source", default=None)
    parser.add_argument("--keyword", default=None)
    parser.add_argument("--corp-code", dest="corp_code", default=None)
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
        parsed = json.loads(raw_payload)
        if not isinstance(parsed, dict):
            raise ValueError("입력 payload는 JSON object여야 합니다.")
        payload = parsed

    overrides = {
        "source": args.source,
        "keyword": args.keyword,
        "corpCode": args.corp_code,
    }

    for key, value in overrides.items():
        if value is not None:
            payload[key] = value

    return payload


def main(argv: list[str] | None = None) -> int:
    parser = build_parser()
    args = parser.parse_args(argv)
    request = _load_request(args)
    response = run_pipeline_request(request, trace_id=args.trace_id or request.get("traceId"))
    sys.stdout.write(json.dumps(response, ensure_ascii=False))
    sys.stdout.write("\n")
    return 0 if response.get("ok") else 1


if __name__ == "__main__":
    raise SystemExit(main())
