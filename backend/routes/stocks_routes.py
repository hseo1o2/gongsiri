from fastapi import APIRouter

from backend.collector.krx.search import find_in_local_master

router = APIRouter(prefix="/api/stocks")


@router.get("/search")
def search_stocks(q: str = ""):
    if not q.strip():
        return {"items": []}

    result = find_in_local_master(q)
    if result is None:
        return {"items": []}

    return {
        "items": [
            {
                "corp_code": result.corp_code,
                "stock_code": result.stock_code,
                "corp_name": result.corp_name,
                "market": result.market,
            }
        ]
    }
