from datetime import datetime, timezone

from fastapi import APIRouter
from fastapi.responses import JSONResponse
from pydantic import BaseModel

from backend.auth.dev_session import resolve_dev_user_id
from backend.collector.dart import fetch_disclosures
from backend.storage.connection import get_repository_provider

router = APIRouter(prefix="/api/disclosure")


class DisclosureCheckRequest(BaseModel):
    corp_code: str


@router.post("/check")
async def check_disclosure(body: DisclosureCheckRequest):
    corp_code = body.corp_code

    try:
        from datetime import date

        today = date.today()
        bgn_de = today.replace(year=today.year - 1).strftime("%Y%m%d")
        end_de = today.strftime("%Y%m%d")
        disclosures = fetch_disclosures(corp_code, bgn_de=bgn_de, end_de=end_de, page_count=10)
    except Exception as exc:
        return JSONResponse(
            status_code=502,
            content={
                "ok": False,
                "error": {
                    "code": "dart_unavailable",
                    "message": f"공시 조회에 실패했습니다: {exc}",
                },
            },
        )

    provider = get_repository_provider()
    user_id = resolve_dev_user_id()
    checkpoint = provider.disclosure_checkpoints.get(user_id=user_id, corp_code=corp_code)
    last_seen = checkpoint["last_seen_rcept_no"] if checkpoint else None

    latest_rcept_no = disclosures[0].rcept_no if disclosures else None
    now_iso = datetime.now(timezone.utc).isoformat()

    if last_seen is None:
        has_new = False
        new_count = 0
        if latest_rcept_no:
            provider.disclosure_checkpoints.upsert(
                user_id=user_id,
                corp_code=corp_code,
                last_seen_rcept_no=latest_rcept_no,
                updated_at=now_iso,
            )
    else:
        new_items = [d for d in disclosures if d.rcept_no > last_seen]
        has_new = len(new_items) > 0
        new_count = len(new_items)
        if latest_rcept_no and latest_rcept_no > last_seen:
            provider.disclosure_checkpoints.upsert(
                user_id=user_id,
                corp_code=corp_code,
                last_seen_rcept_no=latest_rcept_no,
                updated_at=now_iso,
            )

    provider.watchlist.update_last_checked(
        user_id=user_id, corp_code=corp_code, last_checked=now_iso
    )

    return {
        "ok": True,
        "hasNewDisclosure": has_new,
        "newDisclosureCount": new_count,
    }
