import re
from urllib.parse import urljoin

import requests
from bs4 import BeautifulSoup

NAVER_FINANCE_BASE_URL = "https://finance.naver.com"
NAVER_RESEARCH_LIST_URL = "https://finance.naver.com/research/company_list.naver"


def clean_text(text: str | None) -> str:
    if not text:
        return ""
    return re.sub(r"\s+", " ", text).strip()


def fetch_naver_research_reports(
    stock_code: str,
    limit: int = 10,
    page: int = 1,
) -> list[dict]:
    """
    종목코드 기준으로 네이버 금융 종목분석 리포트 리스트를 수집한다.
    예: 카카오 035720, 삼성전자 005930
    """

    params = {
        "keyword": "",
        "brokerCode": "",
        "writeFromDate": "",
        "writeToDate": "",
        "searchType": "itemCode",
        "itemName": "",
        "itemCode": stock_code,
        "x": "0",
        "y": "0",
        "page": str(page),
    }

    headers = {
        "User-Agent": "Mozilla/5.0",
        "Referer": "https://finance.naver.com/",
    }

    response = requests.get(
        NAVER_RESEARCH_LIST_URL,
        params=params,
        headers=headers,
        timeout=10,
    )
    response.raise_for_status()
    response.encoding = "euc-kr"

    soup = BeautifulSoup(response.text, "html.parser")
    reports: list[dict] = []

    for row in soup.select("table.type_1 tr"):
        columns = row.find_all("td")

        if len(columns) < 5:
            continue

        links = columns[0].find_all("a")

        if not links:
            continue

        report_tag = None

        # company_read.naver가 진짜 리포트 상세 링크
        for link in links:
            href = link.get("href", "")
            if "company_read.naver" in href:
                report_tag = link
                break

        # 예외적으로 company_read가 없으면 마지막 링크를 사용
        if report_tag is None:
            report_tag = links[-1]

        title = clean_text(report_tag.get_text())
        detail_url = urljoin(NAVER_FINANCE_BASE_URL, report_tag.get("href", ""))

        # 잘못된 종목 메인 링크는 스킵
        if "item/main.naver" in detail_url:
            continue

        broker = clean_text(columns[1].get_text()) if len(columns) > 1 else ""
        writer = clean_text(columns[2].get_text()) if len(columns) > 2 else ""
        views = clean_text(columns[3].get_text()) if len(columns) > 3 else ""
        date = clean_text(columns[4].get_text()) if len(columns) > 4 else ""

        reports.append(
            {
                "title": title,
                "broker": broker,
                "writer": writer,
                "views": views,
                "date": date,
                "detail_url": detail_url,
                "source": "naver_finance_research",
            }
        )

        if len(reports) >= limit:
            break

    return reports


def fetch_report_pdf_url(detail_url: str) -> str | None:
    """
    리포트 상세 페이지에서 PDF 다운로드 링크를 찾는다.
    """

    headers = {
        "User-Agent": "Mozilla/5.0",
        "Referer": "https://finance.naver.com/",
    }

    response = requests.get(detail_url, headers=headers, timeout=10)
    response.raise_for_status()
    response.encoding = "euc-kr"

    soup = BeautifulSoup(response.text, "html.parser")

    for link in soup.find_all("a"):
        href = link.get("href", "")

        if not href:
            continue

        href_lower = href.lower()

        if (
            ".pdf" in href_lower
            or "download" in href_lower
            or "company_read_pdf" in href_lower
            or "research_download" in href_lower
        ):
            return urljoin(NAVER_FINANCE_BASE_URL, href)

    return None


def fetch_naver_research_pdf_candidates(
    stock_code: str,
    limit: int = 5,
    page: int = 1,
) -> list[dict]:
    """
    종목코드 기준으로 리포트 상세 페이지와 PDF 후보 URL을 수집한다.
    """

    reports = fetch_naver_research_reports(
        stock_code=stock_code,
        limit=limit,
        page=page,
    )

    results = []

    for report in reports:
        try:
            pdf_url = fetch_report_pdf_url(report["detail_url"])
        except Exception:
            pdf_url = None

        results.append(
            {
                **report,
                "pdf_url": pdf_url,
            }
        )

    return results


if __name__ == "__main__":
    result = fetch_naver_research_pdf_candidates("035720", limit=5, page=1)

    if not result:
        print("수집된 네이버 금융 리포트가 없습니다.")
    else:
        for item in result:
            print(item)
