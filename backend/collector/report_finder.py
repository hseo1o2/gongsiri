import os
import re

import requests
from dotenv import load_dotenv

load_dotenv()

NAVER_CLIENT_ID = os.getenv("NAVER_CLIENT_ID")
NAVER_CLIENT_SECRET = os.getenv("NAVER_CLIENT_SECRET")


def clean_html(text: str | None) -> str:
    if not text:
        return ""

    text = re.sub(r"<.*?>", "", text)
    text = text.replace("&quot;", '"')
    text = text.replace("&amp;", "&")
    text = text.replace("&lt;", "<")
    text = text.replace("&gt;", ">")
    text = text.replace("&#39;", "'")
    return text.strip()


def search_report_urls(company_name: str, display: int = 10) -> list[dict]:
    """
    네이버 검색 API를 활용해 종목 관련 리포트/PDF 후보 URL을 수집한다.
    """

    if not NAVER_CLIENT_ID or not NAVER_CLIENT_SECRET:
        raise ValueError("NAVER_CLIENT_ID 또는 NAVER_CLIENT_SECRET이 .env에 없습니다.")

    url = "https://openapi.naver.com/v1/search/webkr.json"

    headers = {
        "X-Naver-Client-Id": NAVER_CLIENT_ID,
        "X-Naver-Client-Secret": NAVER_CLIENT_SECRET,
    }

    params = {
        "query": f"{company_name} 증권사 리포트 PDF",
        "display": display,
        "sort": "date",
    }

    response = requests.get(
        url,
        headers=headers,
        params=params,
        timeout=10,
    )
    response.raise_for_status()

    data = response.json()
    results = []

    for item in data.get("items", []):
        title = clean_html(item.get("title"))
        description = clean_html(item.get("description"))
        link = item.get("link") or ""

        is_pdf = ".pdf" in link.lower()
        is_report_like = any(
            keyword in (title + " " + description)
            for keyword in ["리포트", "기업분석", "Issue Comment", "목표주가", "투자의견"]
        )

        if is_pdf or is_report_like:
            results.append(
                {
                    "title": title,
                    "description": description,
                    "url": link,
                    "is_pdf": is_pdf,
                    "source": "naver_web_search",
                }
            )

    return results


if __name__ == "__main__":
    urls = search_report_urls("카카오")
    for item in urls:
        print(item)
