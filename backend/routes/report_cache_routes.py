from __future__ import annotations

from datetime import datetime, timezone
from pathlib import Path

from fastapi import APIRouter
from fastapi.responses import JSONResponse
from starlette.concurrency import run_in_threadpool

from backend.analyzer.pipeline import CONTRACT_VERSION, run_pipeline_request
from backend.storage.json_store import read_json, write_json

router = APIRouter(prefix="/api/reports", tags=["report-cache"])

REPORTS_DIR = Path("data/reports")


@router.get("/{corp_code}")
async def get_cached_report(corp_code: str):
    path = REPORTS_DIR / f"{corp_code}.json"
    cached = read_json(path, default=None)
    if cached is None:
        return JSONResponse(
            content={"ok": False, "error": {"code": "cache_miss"}},
            status_code=404,
        )
    return JSONResponse(content=cached, status_code=200)


@router.post("/{corp_code}/refresh")
async def refresh_report(corp_code: str):
    pipeline_req = {
        "corpCode": corp_code,
        "source": "refresh",
        "contractVersion": CONTRACT_VERSION,
    }
    response = await run_in_threadpool(
        run_pipeline_request,
        pipeline_req,
        trace_id=f"refresh-{corp_code}",
    )
    generated_at = datetime.now(timezone.utc).isoformat()
    payload = {"generated_at": generated_at, "payload": response}
    REPORTS_DIR.mkdir(parents=True, exist_ok=True)
    write_json(REPORTS_DIR / f"{corp_code}.json", payload)
    return JSONResponse(content={"generated_at": generated_at, **response}, status_code=200)
