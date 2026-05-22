from __future__ import annotations

from datetime import UTC, datetime
from typing import Any

from fastapi import APIRouter, Request
from fastapi.responses import JSONResponse

from backend.auth.dev_session import (
    build_dev_user_scoped_row,
    dev_auth_failure,
    require_dev_auth_mode,
    resolve_dev_user_id,
)
from backend.http_contracts import read_json_object
from backend.storage.connection import get_repository_provider
from backend.storage.schema import SCHEMA_VERSION

router = APIRouter(prefix="/api/v1/dev", tags=["dev-data"])


def _latest_reports_by_corp(provider: Any) -> dict[str, dict[str, Any]]:
    return {
        str(row["corp_code"]): row
        for row in provider.reports.list_latest_for_user(resolve_dev_user_id())
    }


def _watchlist_views(provider: Any) -> list[dict[str, Any]]:
    reports = _latest_reports_by_corp(provider)
    return [
        _watchlist_view(row, reports.get(str(row["corp_code"])))
        for row in provider.watchlist.list_for_user(resolve_dev_user_id())
    ]


def _watchlist_view(row: dict[str, Any], report: dict[str, Any] | None) -> dict[str, Any]:
    return {
        "corp_code": row["corp_code"],
        "corp_name": row["corp_name"],
        "stock_code": row["stock_code"],
        "market": row["market"],
        "risk_level": report.get("risk_level", "normal") if report else "normal",
        "risk_score": report.get("risk_score", 0) if report else 0,
        "last_analyzed": report.get("generated_at") if report else row["added_at"],
    }


def _disclosure_views(provider: Any, *, limit: int = 20) -> list[dict[str, Any]]:
    reports = _latest_reports_by_corp(provider)
    names = {
        row["corp_code"]: row["corp_name"]
        for row in provider.watchlist.list_for_user(resolve_dev_user_id())
    }
    return [
        _disclosure_view(
            row,
            corp_name=names.get(row["corp_code"], row["corp_code"]),
            report=reports.get(row["corp_code"]),
        )
        for row in provider.disclosures.list_recent(user_id=resolve_dev_user_id(), limit=limit)
    ]


def _disclosure_view(
    row: dict[str, Any], *, corp_name: str, report: dict[str, Any] | None
) -> dict[str, Any]:
    return {
        "id": row["rcept_no"],
        "corp_code": row["corp_code"],
        "corp_name": corp_name,
        "risk_level": report.get("risk_level", "normal") if report else "normal",
        "title": row["report_nm"],
        "description": row.get("parsed_text")
        or row.get("category")
        or "공시 원문을 확인해 주세요.",
        "time": _format_disclosure_time(str(row["rcept_dt"]), str(row["observed_at"])),
        "url": row.get("url"),
    }


def _format_disclosure_time(rcept_dt: str, observed_at: str) -> str:
    if len(rcept_dt) == 8:
        return f"{rcept_dt[:4]}-{rcept_dt[4:6]}-{rcept_dt[6:8]}"
    return observed_at


def _dashboard_summary(
    watchlist: list[dict[str, Any]], disclosures: list[dict[str, Any]]
) -> dict[str, int]:
    latest_date = max((d["time"] for d in disclosures), default="")
    return {
        "count": len(watchlist),
        "todayDisclosures": sum(1 for item in disclosures if item["time"] == latest_date),
        "cautionCount": sum(1 for item in watchlist if item["risk_level"] == "caution"),
        "dangerCount": sum(1 for item in watchlist if item["risk_level"] == "high"),
    }


@router.get("/dashboard")
def dashboard() -> JSONResponse:
    failure = require_dev_auth_mode()
    if failure is not None:
        return failure
    provider = get_repository_provider()
    watchlist = _watchlist_views(provider)
    disclosures = _disclosure_views(provider, limit=5)
    return JSONResponse(
        content={
            "ok": True,
            "userId": resolve_dev_user_id(),
            "watchlist": watchlist,
            "recentDisclosures": disclosures,
            "summary": _dashboard_summary(watchlist, disclosures),
        }
    )


@router.get("/watchlist")
def list_watchlist() -> JSONResponse:
    failure = require_dev_auth_mode()
    if failure is not None:
        return failure
    return JSONResponse(content={"ok": True, "items": _watchlist_views(get_repository_provider())})


@router.post("/watchlist")
async def add_watchlist_item(request: Request) -> JSONResponse:
    failure = require_dev_auth_mode()
    if failure is not None:
        return failure
    try:
        payload, _ = await read_json_object(request)
        item = _watchlist_payload(payload)
    except ValueError as exc:
        return JSONResponse(content=dev_auth_failure("invalid_request", str(exc)), status_code=400)

    provider = get_repository_provider()
    saved = provider.watchlist.upsert_item(item)
    report = provider.reports.get_latest_detail(
        user_id=resolve_dev_user_id(), corp_code=saved["corp_code"]
    )
    return JSONResponse(
        content={"ok": True, "item": _watchlist_view(saved, report)}, status_code=201
    )


@router.delete("/watchlist/{corp_code}")
def delete_watchlist_item(corp_code: str) -> JSONResponse:
    failure = require_dev_auth_mode()
    if failure is not None:
        return failure
    get_repository_provider().watchlist.delete_item(
        user_id=resolve_dev_user_id(), corp_code=corp_code
    )
    return JSONResponse(content={"ok": True, "corp_code": corp_code})


@router.get("/disclosures/recent")
def recent_disclosures() -> JSONResponse:
    failure = require_dev_auth_mode()
    if failure is not None:
        return failure
    return JSONResponse(
        content={"ok": True, "items": _disclosure_views(get_repository_provider(), limit=20)}
    )


def _watchlist_payload(payload: dict[str, Any]) -> dict[str, Any]:
    corp_code = str(payload.get("corp_code") or payload.get("corpCode") or "").strip()
    corp_name = str(payload.get("corp_name") or payload.get("corpName") or "").strip()
    stock_code = str(payload.get("stock_code") or payload.get("stockCode") or "").strip()
    market = str(payload.get("market") or "").strip()
    if not all((corp_code, corp_name, stock_code, market)):
        raise ValueError("corp_code, corp_name, stock_code, market은 모두 필요합니다.")
    return build_dev_user_scoped_row(
        {
            "id": f"watch-{corp_code}",
            "corp_code": corp_code,
            "corp_name": corp_name,
            "stock_code": stock_code,
            "market": market,
            "added_at": datetime.now(UTC).isoformat().replace("+00:00", "Z"),
            "source_version": SCHEMA_VERSION,
        }
    )
