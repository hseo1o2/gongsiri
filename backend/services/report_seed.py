import logging
import os

from starlette.concurrency import run_in_threadpool

from backend.analyzer.pipeline import run_pipeline_request
from backend.auth.dev_session import resolve_dev_user_id
from backend.services.report_envelope import build_typed_envelope, now_iso
from backend.storage.connection import get_repository_provider

logger = logging.getLogger(__name__)


async def seed_reports_on_startup() -> None:
    if os.environ.get("GONGSIRI_SKIP_SEED") == "1":
        logger.info("[seed] GONGSIRI_SKIP_SEED=1 — 스킵")
        return
    provider = get_repository_provider()
    user_id = resolve_dev_user_id()
    watchlist = provider.watchlist.list_for_user(user_id)
    for item in watchlist:
        corp_code = str(item.get("corp_code") or "")
        if not corp_code:
            continue
        existing = provider.report_cache.get(user_id=user_id, corp_code=corp_code)
        if existing is not None:
            logger.info(f"[seed] skip {corp_code} (cache hit)")
            continue
        logger.info(f"[seed] seeding {corp_code}...")
        pipeline_req = {"corpCode": corp_code, "source": "seed", "contractVersion": "v1"}
        try:
            response = await run_in_threadpool(
                run_pipeline_request, pipeline_req, trace_id=f"seed-{corp_code}"
            )
            generated_at = now_iso()
            envelope = build_typed_envelope(corp_code, generated_at, response)
            provider.report_cache.upsert(
                user_id=user_id,
                corp_code=corp_code,
                generated_at=generated_at,
                payload=envelope,
            )
            logger.info(f"[seed] {corp_code} done")
        except Exception as e:
            logger.warning(f"[seed] {corp_code} failed: {e}")
            continue
