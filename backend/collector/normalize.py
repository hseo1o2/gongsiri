import json
from pathlib import Path

from backend.collector.dart import fetch_disclosures, fetch_financials
from backend.collector.dart_parser import parse_dart_reports
from backend.collector.document_parse import parse_local_report_files
from backend.collector.krx.search import search_stock
from backend.collector.krx.trade_info import get_trade_info
from backend.collector.naver.news import fetch_news_docs
from backend.schemas.bundle import NormalizedDataBundle


def get_local_report_files(report_dir: str = "data/reports") -> list[str]:
    """
    data/reports 폴더에 있는 PDF/이미지 파일 목록을 반환.
    """
    path = Path(report_dir)

    if not path.exists():
        return []

    allowed_extensions = {".pdf", ".png", ".jpg", ".jpeg"}

    return [
        str(file)
        for file in path.glob("*")
        if file.is_file() and file.suffix.lower() in allowed_extensions
    ]


def build_normalized_bundle(keyword: str) -> NormalizedDataBundle:
    """
    종목명 입력 → 공시/재무/시세/뉴스/공시 원문/외부 리포트를 하나의 표준 bundle로 통합.
    """

    missing_fields = []

    company = search_stock(keyword)

    try:
        disclosures = fetch_disclosures(company.corp_code or "")
    except Exception as e:
        disclosures = []
        missing_fields.append(f"disclosures: {str(e)}")

    try:
        financials = fetch_financials(company.corp_code or "")
    except Exception as e:
        financials = {
            "revenue": None,
            "operating_income": None,
            "equity": None,
            "market_cap": None,
        }
        missing_fields.append(f"financials: {str(e)}")

    try:
        price_volume = get_trade_info(company.stock_code or "", company.market)
    except Exception as e:
        price_volume = {
            "daily": [],
            "monthly_return_max": None,
            "volume_spike_ratio": None,
        }
        missing_fields.append(f"price_volume: {str(e)}")

    try:
        news_docs = fetch_news_docs(company.corp_name)
    except Exception as e:
        news_docs = []
        missing_fields.append(f"news_docs: {str(e)}")

    parsed_reports = []

    try:
        dart_parsed_reports = parse_dart_reports(disclosures, limit=3)
        parsed_reports.extend(dart_parsed_reports)
    except Exception as e:
        missing_fields.append(f"dart_parsed_reports: {str(e)}")

    try:
        local_report_files = get_local_report_files("data/reports")
        upstage_parsed_reports = parse_local_report_files(local_report_files, limit=3)
        parsed_reports.extend(upstage_parsed_reports)
    except Exception as e:
        missing_fields.append(f"upstage_parsed_reports: {str(e)}")

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


def save_normalized_bundle(
    bundle: NormalizedDataBundle,
    output_path: str = "data/normalized_data_bundle.json",
) -> str:
    """
    NormalizedDataBundle을 JSON 파일로 저장.
    """

    output_file = Path(output_path)
    output_file.parent.mkdir(parents=True, exist_ok=True)

    with open(output_file, "w", encoding="utf-8") as f:
        json.dump(
            bundle.model_dump(),
            f,
            ensure_ascii=False,
            indent=2,
        )

    return str(output_file)


def build_and_save_normalized_bundle(
    keyword: str,
    output_path: str = "data/normalized_data_bundle.json",
) -> dict:
    """
    종목명 입력 → bundle 생성 → JSON 저장까지 한 번에 수행.
    """

    bundle = build_normalized_bundle(keyword)
    saved_path = save_normalized_bundle(bundle, output_path)

    return {
        "message": "normalized_data_bundle.json 저장 완료",
        "path": saved_path,
        "company": bundle.company.corp_name,
        "stock_code": bundle.company.stock_code,
        "missing_fields": bundle.missing_fields,
    }
