import json
from pathlib import Path

from backend.collector.dart import fetch_disclosures, fetch_financials
from backend.collector.dart_parser import parse_dart_reports
from backend.collector.document_parse import parse_local_report_files
from backend.collector.krx.search import search_stock
from backend.collector.krx.trade_info import get_trade_info
from backend.collector.naver.news import fetch_news_docs
from backend.collector.report_downloader import download_pdf_reports_from_candidates
from backend.collector.report_finder import search_report_urls
from backend.schemas.bundle import NormalizedDataBundle


def is_valid_pdf_file(file_path: str) -> bool:
    path = Path(file_path)

    if not path.exists() or path.suffix.lower() != ".pdf":
        return False

    try:
        with open(path, "rb") as f:
            return f.read(4) == b"%PDF"
    except Exception:
        return False


def get_local_report_files(report_dir: str = "data/reports") -> list[str]:
    path = Path(report_dir)

    if not path.exists():
        return []

    valid_files = []

    for file in path.glob("*"):
        if not file.is_file():
            continue

        if file.suffix.lower() not in {".pdf", ".png", ".jpg", ".jpeg"}:
            continue

        if file.suffix.lower() == ".pdf" and not is_valid_pdf_file(str(file)):
            file.unlink(missing_ok=True)
            continue

        valid_files.append(str(file))

    return valid_files


def deduplicate_paths(paths: list[str]) -> list[str]:
    seen = set()
    unique_paths = []

    for path in paths:
        normalized = str(Path(path))

        if normalized in seen:
            continue

        seen.add(normalized)
        unique_paths.append(normalized)

    return unique_paths


def filter_successful_parsed_reports(parsed_reports):
    """
    Upstage 실패 결과는 B팀 입력에서 제외한다.
    """
    return [report for report in parsed_reports if not report.source.startswith("UPSTAGE_ERROR")]


def build_normalized_bundle(keyword: str) -> NormalizedDataBundle:
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

    downloaded_report_files = []

    try:
        report_candidates = search_report_urls(company.corp_name, display=10)
        downloaded_report_files = download_pdf_reports_from_candidates(report_candidates)
    except Exception as e:
        missing_fields.append(f"external_report_download: {str(e)}")

    parsed_reports = []

    try:
        dart_parsed_reports = parse_dart_reports(disclosures, limit=3)
        parsed_reports.extend(dart_parsed_reports)
    except Exception as e:
        missing_fields.append(f"dart_parsed_reports: {str(e)}")

    try:
        local_report_files = get_local_report_files("data/reports")
        all_report_files = deduplicate_paths(local_report_files + downloaded_report_files)

        upstage_parsed_reports = parse_local_report_files(all_report_files, limit=5)
        upstage_parsed_reports = filter_successful_parsed_reports(upstage_parsed_reports)

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
    bundle = build_normalized_bundle(keyword)
    saved_path = save_normalized_bundle(bundle, output_path)

    return {
        "message": "normalized_data_bundle.json 저장 완료",
        "path": saved_path,
        "company": bundle.company.corp_name,
        "stock_code": bundle.company.stock_code,
        "missing_fields": bundle.missing_fields,
    }
