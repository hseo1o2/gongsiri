import logging

from fastapi import APIRouter

from backend.collector.krx.search import resolve_companies

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/stocks")


@router.get("/search")
def search_stocks(q: str = ""):
    if not q.strip():
        return {"items": []}

    logger.info("종목 검색 요청: q=%s", q)
    companies = resolve_companies(q)

    items = [
        {
            "corp_code": c.corp_code,
            "stock_code": c.stock_code,
            "corp_name": c.corp_name,
            "market": c.market,
        }
        for c in companies
        if c.corp_code  # corp_code null 항목 제외
    ]

    logger.info("종목 검색 결과: q=%s, count=%d", q, len(items))
    return {"items": items}
