import re

import requests
from bs4 import BeautifulSoup

from backend.schemas.bundle import DisclosureItem, ParsedReport


def clean_text(text: str) -> str:
    text = re.sub(r"\s+", " ", text)
    return text.strip()


def fetch_dart_html_text(rcept_no: str) -> str:
    """
    DART 공시 원문 페이지에서 HTML 텍스트를 가져온다.
    """
    url = f"https://dart.fss.or.kr/dsaf001/main.do?rcpNo={rcept_no}"

    headers = {
        "User-Agent": "Mozilla/5.0",
    }

    response = requests.get(url, headers=headers, timeout=10)
    response.raise_for_status()

    soup = BeautifulSoup(response.text, "lxml")

    text = soup.get_text(" ", strip=True)
    return clean_text(text)


def parse_dart_reports(
    disclosures: list[DisclosureItem],
    limit: int = 3,
) -> list[ParsedReport]:
    """
    공시 목록 중 앞에서 limit개만 원문 텍스트로 파싱한다.
    """
    parsed_reports = []

    for disclosure in disclosures[:limit]:
        try:
            parsed_text = fetch_dart_html_text(disclosure.rcept_no)

            if not parsed_text:
                continue

            parsed_reports.append(
                ParsedReport(
                    source=f"DART:{disclosure.rcept_no}:{disclosure.report_nm}",
                    parsed_text=parsed_text[:5000],
                )
            )

        except Exception:
            continue

    return parsed_reports
