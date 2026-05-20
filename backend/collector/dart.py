import os

import requests
from dotenv import load_dotenv

from backend.schemas.bundle import DisclosureItem, FinancialData

load_dotenv()


def get_dart_api_key() -> str | None:
    return os.getenv("DART_API_KEY")


def get_disclosure_url(rcept_no: str) -> str:
    return f"https://dart.fss.or.kr/dsaf001/main.do?rcpNo={rcept_no}"


def classify_disclosure(report_nm: str) -> str:
    """
    공시명 기반 중요 공시 카테고리 분류.
    B팀의 작전주 6개 항목 판단에 바로 쓰기 위한 1차 태깅.
    """
    name = report_nm.replace(" ", "").strip()

    if "전환사채" in name or "CB" in name:
        return "convertible_bond"

    if "신주인수권부사채" in name or "BW" in name:
        return "bond_with_warrant"

    if "유상증자" in name:
        return "paid_in_capital_increase"

    if "무상증자" in name:
        return "bonus_issue"

    if "감자" in name:
        return "capital_reduction"

    if "최대주주변경" in name or "최대주주" in name:
        return "largest_shareholder_change"

    if "사업보고서" in name:
        return "annual_report"

    if "반기보고서" in name:
        return "half_year_report"

    if "분기보고서" in name:
        return "quarterly_report"

    if "주요사항보고서" in name:
        return "material_event_report"

    if "합병" in name:
        return "merger"

    if "분할" in name:
        return "spin_off"

    if "특수관계인" in name and "자금대여" in name:
        return "related_party_loan"

    if "주식매수선택권" in name:
        return "stock_option"

    if "기업설명회" in name or "IR" in name:
        return "ir_event"

    return "other"


def fetch_disclosures(
    corp_code: str,
    bgn_de: str = "20240101",
    end_de: str = "20241231",
    page_count: int = 20,
) -> list[DisclosureItem]:
    api_key = get_dart_api_key()

    if not api_key:
        raise ValueError("DART_API_KEY가 .env에 없습니다.")

    url = "https://opendart.fss.or.kr/api/list.json"

    params = {
        "crtfc_key": api_key,
        "corp_code": corp_code,
        "bgn_de": bgn_de,
        "end_de": end_de,
        "page_no": 1,
        "page_count": page_count,
        "sort": "date",
        "sort_mth": "desc",
    }

    response = requests.get(url, params=params, timeout=10)
    response.raise_for_status()

    data = response.json()

    if data.get("status") != "000":
        raise RuntimeError(
            f"OpenDART API error: {data.get('status')} / {data.get('message')}"
        )

    disclosures = []

    for item in data.get("list", []):
        rcept_no = item.get("rcept_no", "")
        report_nm = item.get("report_nm", "").strip()

        disclosures.append(
            DisclosureItem(
                rcept_no=rcept_no,
                report_nm=report_nm,
                rcept_dt=item.get("rcept_dt", ""),
                parsed_text=None,
                url=get_disclosure_url(rcept_no),
                category=classify_disclosure(report_nm),
            )
        )

    return disclosures


def fetch_financials(
    corp_code: str,
    bsns_year: str = "2024",
    reprt_code: str = "11013",
) -> FinancialData:
    """
    OpenDART 단일회사 주요계정 API로 주요 재무정보 수집.
    reprt_code:
    - 11011: 사업보고서
    - 11012: 반기보고서
    - 11013: 1분기보고서
    - 11014: 3분기보고서
    """
    api_key = get_dart_api_key()

    if not api_key:
        raise ValueError("DART_API_KEY가 .env에 없습니다.")

    url = "https://opendart.fss.or.kr/api/fnlttSinglAcnt.json"

    params = {
        "crtfc_key": api_key,
        "corp_code": corp_code,
        "bsns_year": bsns_year,
        "reprt_code": reprt_code,
    }

    response = requests.get(url, params=params, timeout=10)
    response.raise_for_status()

    data = response.json()

    if data.get("status") != "000":
        return FinancialData(
            revenue=None,
            operating_income=None,
            equity=None,
            market_cap=None,
        )

    revenue = None
    operating_income = None
    equity = None

    for item in data.get("list", []):
        account_nm = item.get("account_nm", "")
        amount_raw = item.get("thstrm_amount", "")

        try:
            amount = float(amount_raw.replace(",", ""))
        except ValueError:
            continue

        if account_nm == "매출액":
            revenue = amount

        elif account_nm == "영업이익":
            operating_income = amount

        elif account_nm == "자본총계":
            equity = amount

    return FinancialData(
        revenue=revenue,
        operating_income=operating_income,
        equity=equity,
        market_cap=None,
    )
