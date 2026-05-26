from datetime import datetime, timezone

from fastapi import APIRouter
from fastapi.concurrency import run_in_threadpool

from backend.collector.krx.trade_info import fetch_latest_price

router = APIRouter(prefix="/api/quote")


@router.get("/{stock_code}")
async def get_quote(stock_code: str, market: str = "KOSPI"):
    price, change_rate = await run_in_threadpool(fetch_latest_price, stock_code, market)
    return {
        "stock_code": stock_code,
        "price": price,
        "change_rate": change_rate,
        "updated_at": datetime.now(timezone.utc).isoformat(),
    }
