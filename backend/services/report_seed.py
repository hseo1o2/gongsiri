import logging
import os
from datetime import datetime, timezone
from pathlib import Path

from starlette.concurrency import run_in_threadpool

from backend.analyzer.pipeline import run_pipeline_request
from backend.storage.json_store import read_json, write_json

logger = logging.getLogger(__name__)
WATCHLIST_PATH = Path("data/watchlist.json")
REPORTS_DIR = Path("data/reports")


async def seed_reports_on_startup() -> None:
    if os.environ.get("GONGSIRI_SKIP_SEED") == "1":
        logger.info("[seed] GONGSIRI_SKIP_SEED=1 — 스킵")
        return
    watchlist = read_json(WATCHLIST_PATH, default={"items": []})
    items = watchlist.get("items", [])
    REPORTS_DIR.mkdir(parents=True, exist_ok=True)
    for item in items:
        corp_code = item.get("corp_code")
        if not corp_code:
            continue
        out_path = REPORTS_DIR / f"{corp_code}.json"
        if out_path.exists():
            logger.info(f"[seed] skip {corp_code} (cache hit)")
            continue
        logger.info(f"[seed] seeding {corp_code}...")
        pipeline_req = {"corpCode": corp_code, "source": "seed", "contractVersion": "v1"}
        try:
            response = await run_in_threadpool(
                run_pipeline_request, pipeline_req, trace_id=f"seed-{corp_code}"
            )
            write_json(out_path, {"generated_at": _now_iso(), "payload": response})
            logger.info(f"[seed] {corp_code} done")
        except Exception as e:
            logger.warning(f"[seed] {corp_code} failed: {e}")
            continue


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()
