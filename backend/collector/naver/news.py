import os
import re
from email.utils import parsedate_to_datetime

import requests
from dotenv import load_dotenv

from backend.schemas.bundle import NewsDocument

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


def normalize_pub_date(pub_date: str | None) -> str:
    """
    Naver pubDate 예시:
    Tue, 18 May 2026 10:30:00 +0900

    반환:
    2026-05-18
    """
    if not pub_date:
        return ""

    try:
        return parsedate_to_datetime(pub_date).strftime("%Y-%m-%d")
    except Exception:
        return pub_date


def fetch_news_docs(company_name: str, display: int = 10) -> list[NewsDocument]:
    """
    네이버 뉴스 검색 API 결과를 NormalizedDataBundle.news_docs에 맞게 변환한다.
    """

    if not NAVER_CLIENT_ID or not NAVER_CLIENT_SECRET:
        raise ValueError("NAVER_CLIENT_ID 또는 NAVER_CLIENT_SECRET이 .env에 없습니다.")

    url = "https://openapi.naver.com/v1/search/news.json"

    headers = {
        "X-Naver-Client-Id": NAVER_CLIENT_ID,
        "X-Naver-Client-Secret": NAVER_CLIENT_SECRET,
    }

    params = {
        "query": f"{company_name} 주식 공시",
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
    news_docs: list[NewsDocument] = []

    for item in data.get("items", []):
        title = clean_html(item.get("title"))
        body = clean_html(item.get("description"))
        date = normalize_pub_date(item.get("pubDate"))
        news_url = item.get("originallink") or item.get("link") or ""

        news_docs.append(
            NewsDocument(
                title=title,
                date=date,
                body=body,
                url=news_url,
            )
        )

    return news_docs


if __name__ == "__main__":
    result = fetch_news_docs("카카오")
    for news in result:
        print(news.model_dump())
