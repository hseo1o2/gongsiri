from __future__ import annotations

from pathlib import Path
from typing import Any

from backend.collector.dart import fetch_disclosures, fetch_financials
from backend.collector.krx.search import load_stock_master, search_stock
from backend.collector.krx.trade_info import get_trade_info
from backend.collector.naver.news import fetch_news_docs
from backend.collector.adapters.external_api_common import failure as _failure
from backend.collector.adapters.external_api_common import is_rate_limited as _is_rate_limited
from backend.collector.adapters.external_api_parse import parse_research_preview
from backend.schemas.external_api import (
    DartFilingEvidence,
    ExternalResearchReport,
    FinancialSnapshot,
    NewsArticle,
    StockSearchResult,
    TradeInfoSnapshot,
)


def search_stock_results(query: str) -> dict[str, Any]:
    normalized = query.strip()
    if not normalized:
        return _failure("krx_stock_search", "invalid_request", "검색어가 비어 있습니다.")

    try:
        local_master = load_stock_master(create_if_missing=False)
        matches = []
        for info in local_master.values():
            corp_name = str(info.get("corp_name") or "")
            stock_code = str(info.get("stock_code") or "")
            corp_code = str(info.get("corp_code") or "")
            haystack = " ".join([corp_name, stock_code, corp_code]).lower()
            if normalized.lower() in haystack:
                matches.append(
                    StockSearchResult(
                        corp_name=corp_name,
                        stock_code=stock_code,
                        corp_code=corp_code or None,
                        market=info.get("market"),
                    ).model_dump()
                )
        if matches:
            return {
                "ok": True,
                "source_id": "krx_stock_search",
                "availability": "available",
                "results": matches[:8],
                "evidence": [{"source": "stock_master", "detail": "local_master_match"}],
            }

        company = search_stock(normalized, persist_result=False)
        return {
            "ok": True,
            "source_id": "krx_stock_search",
            "availability": "degraded",
            "results": [StockSearchResult(**company.model_dump()).model_dump()],
            "evidence": [{"source": "krx_stock_search", "detail": "remote_lookup"}],
        }
    except ValueError as exc:
        return _failure("krx_stock_search", "invalid_request", str(exc))
    except Exception as exc:
        message = str(exc)
        if _is_rate_limited(message):
            code = "rate_limited"
        else:
            code = "not_found" if "찾지 못했습니다" in message else "source_unavailable"
        return _failure("krx_stock_search", code, message)


def trade_info_snapshot(stock_code: str, market: str) -> dict[str, Any]:
    if not stock_code.strip() or not market.strip():
        return _failure(
            "krx_trade_info",
            "invalid_request",
            "stock_code와 market이 모두 필요합니다.",
        )
    try:
        snapshot = get_trade_info(stock_code.strip(), market.strip())
        latest_date = snapshot.daily[-1].date if snapshot.daily else None
        data = TradeInfoSnapshot(
            stock_code=stock_code.strip(),
            market=market.strip(),
            monthly_return_max=snapshot.monthly_return_max,
            volume_spike_ratio=snapshot.volume_spike_ratio,
            latest_date=latest_date,
        )
        availability = "available" if snapshot.daily else "degraded"
        detail = "cached_or_remote_snapshot" if snapshot.daily else "no_trade_rows"
        return {
            "ok": True,
            "source_id": "krx_trade_info",
            "availability": availability,
            "snapshot": data.model_dump(),
            "evidence": [{"source": "krx_trade_info", "detail": detail}],
        }
    except Exception as exc:
        message = str(exc)
        code = "rate_limited" if _is_rate_limited(message) else "source_unavailable"
        return _failure("krx_trade_info", code, message)


def news_search_results(query: str) -> dict[str, Any]:
    normalized = query.strip()
    if not normalized:
        return _failure("naver_news", "invalid_request", "query가 비어 있습니다.")
    try:
        docs = fetch_news_docs(normalized)
        if not docs:
            return _failure(
                "naver_news",
                "no_results",
                "뉴스 결과가 없습니다.",
                availability="degraded",
            )
        articles = [
            NewsArticle(
                title=item.title,
                source="naver_news",
                url=item.url,
                published_at=item.date,
                query=normalized,
                matched_theme=None,
                summary=item.body,
            ).model_dump()
            for item in docs
        ]
        return {
            "ok": True,
            "source_id": "naver_news",
            "availability": "available",
            "articles": articles,
            "evidence": [{"source": "naver_news", "detail": f"count={len(articles)}"}],
        }
    except ValueError as exc:
        message = str(exc)
        code = "missing_env" if "NAVER_CLIENT" in message else "invalid_request"
        return _failure("naver_news", code, message)
    except Exception as exc:
        message = str(exc)
        code = "rate_limited" if _is_rate_limited(message) else "source_unavailable"
        return _failure("naver_news", code, message)


def dart_evidence_snapshot(corp_code: str) -> dict[str, Any]:
    normalized = corp_code.strip()
    if not normalized:
        return _failure("opendart_evidence", "invalid_request", "corp_code가 비어 있습니다.")
    try:
        disclosures = fetch_disclosures(normalized)
        financials = fetch_financials(normalized)
        evidence = [DartFilingEvidence(**item.model_dump()).model_dump() for item in disclosures]
        snapshot = FinancialSnapshot(**financials.model_dump()).model_dump()
        availability = "available" if disclosures or any(snapshot.values()) else "degraded"
        return {
            "ok": True,
            "source_id": "opendart_evidence",
            "availability": availability,
            "filings": evidence,
            "financialSnapshot": snapshot,
            "evidence": [{"source": "opendart_evidence", "detail": f"filings={len(evidence)}"}],
        }
    except ValueError as exc:
        message = str(exc)
        code = "missing_env" if "DART_API_KEY" in message else "invalid_request"
        return _failure("opendart_evidence", code, message)
    except Exception as exc:
        message = str(exc)
        code = "rate_limited" if _is_rate_limited(message) else "source_unavailable"
        return _failure("opendart_evidence", code, message)


