from __future__ import annotations

import io
import json
import os
import subprocess
import sys
import unittest
from pathlib import Path
from unittest import mock

from backend.collector.cli import fetch_disclosures as cli

REPO_ROOT = Path(__file__).resolve().parents[1]


class FetchDisclosuresCliTests(unittest.TestCase):
    def test_load_request_prefers_cli_overrides(self) -> None:
        args = cli.build_parser().parse_args(
            [
                "--input",
                json.dumps({"keyword": "카카오", "pageCount": 10}),
                "--corp-code",
                "00126380",
                "--page-count",
                "5",
            ]
        )

        request = cli._load_request(args)

        self.assertEqual(request["keyword"], "카카오")
        self.assertEqual(request["corpCode"], "00126380")
        self.assertEqual(request["pageCount"], 5)

    def test_main_propagates_trace_id_from_payload(self) -> None:
        stdout = io.StringIO()

        with (
            mock.patch.object(
                cli,
                "run_fetch_disclosures_request",
                return_value={
                    "ok": False,
                    "traceId": "payload-trace",
                    "contractVersion": "v1",
                    "observedAt": "2026-05-20T12:00:00Z",
                    "error": {"code": "missing_env", "message": "missing"},
                    "evidence": [],
                },
            ) as run_mock,
            mock.patch.object(cli.sys, "stdout", stdout),
        ):
            exit_code = cli.main(
                [
                    "--input",
                    json.dumps({"corpCode": "00126380", "traceId": "payload-trace"}),
                ]
            )

        self.assertEqual(exit_code, 1)
        self.assertEqual(
            run_mock.call_args.kwargs["trace_id"],
            "payload-trace",
        )
        self.assertEqual(json.loads(stdout.getvalue())["traceId"], "payload-trace")

    def test_main_returns_typed_invalid_request_for_bad_json(self) -> None:
        stdout = io.StringIO()

        with mock.patch.object(cli.sys, "stdout", stdout):
            exit_code = cli.main(["--input", "{bad-json"])

        payload = json.loads(stdout.getvalue())
        self.assertEqual(exit_code, 1)
        self.assertFalse(payload["ok"])
        self.assertEqual(payload["error"]["code"], "invalid_request")
        self.assertEqual(payload["traceId"], "invalid-request")

    def test_main_reads_json_from_stdin(self) -> None:
        stdin = io.StringIO(json.dumps({"corpCode": "00126380", "traceId": "stdin-trace"}))
        stdout = io.StringIO()

        with (
            mock.patch.object(cli.sys, "stdin", stdin),
            mock.patch.object(cli.sys, "stdout", stdout),
            mock.patch.object(
                cli,
                "run_fetch_disclosures_request",
                return_value={
                    "ok": False,
                    "traceId": "stdin-trace",
                    "contractVersion": "v1",
                    "observedAt": "2026-05-20T12:00:00Z",
                    "error": {"code": "missing_env", "message": "missing"},
                    "evidence": [],
                },
            ),
        ):
            exit_code = cli.main([])

        self.assertEqual(exit_code, 1)
        self.assertEqual(json.loads(stdout.getvalue())["traceId"], "stdin-trace")

    def test_canonical_module_invocation_emits_typed_failure_json(self) -> None:
        payload = json.dumps(
            {
                "corpCode": "00126380",
                "traceId": "subprocess-trace",
            }
        )

        result = subprocess.run(
            [sys.executable, "-m", "backend.collector.cli.fetch_disclosures"],
            input=payload,
            text=True,
            capture_output=True,
            cwd=REPO_ROOT,
            env={"PATH": os.environ.get("PATH", ""), "PYTHONPATH": str(REPO_ROOT)},
        )

        self.assertEqual(result.returncode, 1)
        self.assertEqual(result.stderr, "")
        parsed = json.loads(result.stdout)
        self.assertFalse(parsed["ok"])
        self.assertEqual(parsed["error"]["code"], "missing_env")
        self.assertEqual(parsed["traceId"], "subprocess-trace")


if __name__ == "__main__":
    unittest.main()
