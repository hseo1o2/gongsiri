from __future__ import annotations

from pathlib import Path

from backend.collector.company_resolver import resolve_company_read_only
from backend.collector.dart import fetch_disclosures, fetch_financials
from backend.collector.krx.search import find_by_corp_code
from backend.collector.krx.trade_info import get_trade_info
from backend.collector.naver.news import fetch_news_docs
from backend.schemas.bundle import CompanyInfo, NormalizedDataBundle

ALLOWED_REPORT_EXTENSIONS = {".pdf", ".png", ".jpg", ".jpeg"}


def get_local_report_files_read_only(report_dir: str = "data/reports") -> list[str]:
    path = Path(report_dir)

    if not path.exists():
        return []

    return [
        str(file)
        for file in path.glob("*")
        if file.is_file() and file.suffix.lower() in ALLOWED_REPORT_EXTENSIONS
    ]


def resolve_runtime_company(
    *, keyword: str | None = None, corp_code: str | None = None
) -> CompanyInfo:
    normalized_keyword = (keyword or "").strip()
    normalized_corp_code = (corp_code or "").strip()

    if normalized_corp_code:
        local_by_corp_code = find_by_corp_code(normalized_corp_code, create_if_missing=False)
        if local_by_corp_code:
            return local_by_corp_code

        if normalized_keyword:
            resolved = resolve_company_read_only(normalized_keyword)
            return resolved.model_copy(update={"corp_code": normalized_corp_code})

        return CompanyInfo(
            corp_name=normalized_corp_code,
            stock_code="",
            corp_code=normalized_corp_code,
            market=None,
        )

    if normalized_keyword:
        return resolve_company_read_only(normalized_keyword)

    raise ValueError("keyword 또는 corpCode 중 하나는 반드시 필요합니다.")


def build_runtime_normalized_bundle(
    *, keyword: str | None = None, corp_code: str | None = None
) -> NormalizedDataBundle:
    missing_fields: list[str] = []
    company = resolve_runtime_company(keyword=keyword, corp_code=corp_code)
    resolved_corp_code = company.corp_code or corp_code or ""

    try:
        disclosures = fetch_disclosures(resolved_corp_code)
    except Exception as exc:
        disclosures = []
        missing_fields.append(f"disclosures: {str(exc)}")

    try:
        financials = fetch_financials(resolved_corp_code)
    except Exception as exc:
        financials = {
            "revenue": None,
            "operating_income": None,
            "equity": None,
            "market_cap": None,
        }
        missing_fields.append(f"financials: {str(exc)}")

    try:
        if company.stock_code and company.market:
            price_volume = get_trade_info(company.stock_code, company.market)
        else:
            raise ValueError("stock_code 또는 market 정보가 부족합니다.")
    except Exception as exc:
        price_volume = {
            "daily": [],
            "monthly_return_max": None,
            "volume_spike_ratio": None,
        }
        missing_fields.append(f"price_volume: {str(exc)}")

    try:
        if company.corp_name and company.corp_name != (corp_code or ""):
            news_docs = fetch_news_docs(company.corp_name)
        else:
            news_docs = []
    except Exception as exc:
        news_docs = []
        missing_fields.append(f"news_docs: {str(exc)}")

    parsed_reports = []

    try:
        from backend.collector.dart_parser import parse_dart_reports

        parsed_reports.extend(parse_dart_reports(disclosures, limit=3))
    except Exception as exc:
        missing_fields.append(f"dart_parsed_reports: {str(exc)}")

    try:
        from backend.collector.document_parse import parse_local_report_files

        local_report_files = get_local_report_files_read_only()
        parsed_reports.extend(parse_local_report_files(local_report_files, limit=5))
    except Exception as exc:
        missing_fields.append(f"upstage_parsed_reports: {str(exc)}")

    if not disclosures:
        missing_fields.append("disclosures")

    if not getattr(price_volume, "daily", []):
        missing_fields.append("price_volume")

    if not news_docs:
        missing_fields.append("news_docs")

    if not parsed_reports:
        missing_fields.append("parsed_reports")

    return NormalizedDataBundle(
        company=company,
        disclosures=disclosures,
        financials=financials,
        price_volume=price_volume,
        news_docs=news_docs,
        parsed_reports=parsed_reports,
        missing_fields=missing_fields,
    )
