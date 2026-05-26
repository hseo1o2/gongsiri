import logging
import os

from backend.auth.dev_session import resolve_dev_user_id
from backend.report_runtime_common import detail_view_from_report_row
from backend.services.report_envelope import now_iso
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
            cached_report = existing.get("payload", {}).get("report", {})
            if cached_report.get("shortTermReport"):
                logger.info(f"[seed] skip {corp_code} (cache hit)")
                continue
            logger.info(
                f"[seed] {corp_code} cache has empty body — rebuilding from analysis_reports"
            )
        stored = provider.reports.get_latest_detail(user_id=user_id, corp_code=corp_code)
        if stored is None:
            logger.info(f"[seed] skip {corp_code} (no analysis_reports row)")
            continue
        generated_at = str(stored.get("generated_at") or now_iso())
        payload = detail_view_from_report_row(stored, fallback={"used": False})
        envelope = {"generated_at": generated_at, "payload": payload}
        provider.report_cache.upsert(
            user_id=user_id,
            corp_code=corp_code,
            generated_at=generated_at,
            payload=envelope,
        )
        logger.info(f"[seed] {corp_code} seeded from analysis_reports")
