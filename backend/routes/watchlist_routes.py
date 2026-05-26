from pathlib import Path

from fastapi import APIRouter, HTTPException
from fastapi.responses import JSONResponse

from backend.schemas.watchlist import WatchlistItem
from backend.storage.json_store import read_json, write_json

router = APIRouter(prefix="/api/watchlist")

WATCHLIST_PATH = Path("data/watchlist.json")


@router.get("")
def get_watchlist():
    data = read_json(WATCHLIST_PATH, default={"items": []})
    return data


@router.post("", status_code=201)
def add_watchlist_item(item: WatchlistItem):
    data = read_json(WATCHLIST_PATH, default={"items": []})
    items = data.get("items", [])

    for existing in items:
        if existing.get("corp_code") == item.corp_code:
            raise HTTPException(status_code=409, detail="이미 워치리스트에 있는 종목입니다.")

    items.append(item.model_dump())
    write_json(WATCHLIST_PATH, {"items": items})
    return JSONResponse(content={"ok": True}, status_code=201)


@router.delete("")
def delete_watchlist_item(corp_code: str):
    data = read_json(WATCHLIST_PATH, default={"items": []})
    items = data.get("items", [])
    filtered = [i for i in items if i.get("corp_code") != corp_code]
    write_json(WATCHLIST_PATH, {"items": filtered})
    return {"ok": True}
