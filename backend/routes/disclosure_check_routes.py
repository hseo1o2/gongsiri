from datetime import datetime, timezone
from pathlib import Path

from fastapi import APIRouter
from fastapi.responses import JSONResponse
from pydantic import BaseModel

from backend.collector.dart import fetch_disclosures
from backend.storage.json_store import read_json, write_json

router = APIRouter(prefix="/api/disclosure")

WATCHLIST_PATH = Path("data/watchlist.json")
CHECKPOINTS_PATH = Path("data/disclosure_checkpoints.json")


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

    checkpoints: dict = read_json(CHECKPOINTS_PATH, default={})
    last_seen = checkpoints.get(corp_code)

    latest_rcept_no = disclosures[0].rcept_no if disclosures else None

    if last_seen is None:
        # 첫 호출: false positive 방지 — 현재 최신을 저장하고 false 반환
        has_new = False
        new_count = 0
        if latest_rcept_no:
            checkpoints[corp_code] = latest_rcept_no
            write_json(CHECKPOINTS_PATH, checkpoints)
    else:
        # 이전 체크포인트보다 새 rcept_no 개수 계산 (rcept_no는 날짜+순번 오름차순 문자열)
        new_items = [d for d in disclosures if d.rcept_no > last_seen]
        has_new = len(new_items) > 0
        new_count = len(new_items)
        if latest_rcept_no and latest_rcept_no > last_seen:
            checkpoints[corp_code] = latest_rcept_no
            write_json(CHECKPOINTS_PATH, checkpoints)

    now_iso = datetime.now(timezone.utc).isoformat()
    watchlist = read_json(WATCHLIST_PATH, default={"items": []})
    items = watchlist.get("items", [])
    for item in items:
        if item.get("corp_code") == corp_code:
            item["last_checked"] = now_iso
            break
    write_json(WATCHLIST_PATH, {"items": items})

    return {
        "ok": True,
        "hasNewDisclosure": has_new,
        "newDisclosureCount": new_count,
    }
