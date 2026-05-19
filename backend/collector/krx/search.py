import json
from pathlib import Path
from typing import Any

import requests

from backend.schemas.bundle import CompanyInfo

K_SKILL_SEARCH_URL = "https://k-skill-proxy.nomadamas.org/v1/korean-stock/search"
DEFAULT_BAS_DD = "20250516"

PROJECT_ROOT = Path(__file__).resolve().parents[3]
STOCK_MASTER_PATH = PROJECT_ROOT / "assets" / "stock_master.json"


DEFAULT_LOCAL_STOCKS: dict[str, dict[str, str]] = {
    "카카오": {
        "corp_name": "카카오",
        "stock_code": "035720",
        "corp_code": "00258801",
        "market": "KOSPI",
    },
    "삼성전자": {
        "corp_name": "삼성전자",
        "stock_code": "005930",
        "corp_code": "00126380",
        "market": "KOSPI",
    },
    "네이버": {
        "corp_name": "NAVER",
        "stock_code": "035420",
        "corp_code": "00266961",
        "market": "KOSPI",
    },
}


SEARCH_CACHE: dict[str, CompanyInfo] = {}


def ensure_stock_master_file() -> None:
    """
    assets/stock_master.json이 없으면 기본 종목 DB로 생성한다.
    """
    STOCK_MASTER_PATH.parent.mkdir(parents=True, exist_ok=True)

    if not STOCK_MASTER_PATH.exists():
        with open(STOCK_MASTER_PATH, "w", encoding="utf-8") as f:
            json.dump(DEFAULT_LOCAL_STOCKS, f, ensure_ascii=False, indent=2)


def load_stock_master() -> dict[str, dict[str, Any]]:
    """
    로컬 종목 마스터 파일을 읽는다.
    """
    ensure_stock_master_file()

    try:
        with open(STOCK_MASTER_PATH, "r", encoding="utf-8") as f:
            data = json.load(f)

        if not isinstance(data, dict):
            return DEFAULT_LOCAL_STOCKS.copy()

        return data

    except Exception:
        return DEFAULT_LOCAL_STOCKS.copy()


def save_stock_master(stock_master: dict[str, dict[str, Any]]) -> None:
    """
    새로 찾은 종목 정보를 stock_master.json에 저장한다.
    """
    STOCK_MASTER_PATH.parent.mkdir(parents=True, exist_ok=True)

    with open(STOCK_MASTER_PATH, "w", encoding="utf-8") as f:
        json.dump(stock_master, f, ensure_ascii=False, indent=2)


def normalize_keyword(keyword: str) -> str:
    return keyword.strip()


def find_in_local_master(keyword: str) -> CompanyInfo | None:
    """
    stock_master.json에서 먼저 종목을 찾는다.
    정확히 일치하는 종목명을 우선 사용한다.
    """
    keyword = normalize_keyword(keyword)
    stock_master = load_stock_master()

    if keyword in stock_master:
        return CompanyInfo(**stock_master[keyword])

    # 부분 검색 보조: 사용자가 '카카'처럼 입력한 경우도 대응
    for name, info in stock_master.items():
        if keyword and keyword in name:
            return CompanyInfo(**info)

    return None


def parse_kskill_item(item: dict[str, Any], fallback_name: str) -> CompanyInfo:
    """
    k-skill 응답 포맷 차이를 흡수해서 CompanyInfo로 변환한다.
    """
    corp_name = (
        item.get("corp_name")
        or item.get("itmsNm")
        or item.get("isuNm")
        or item.get("name")
        or fallback_name
    )

    stock_code = (
        item.get("stock_code") or item.get("srtnCd") or item.get("isuSrtCd") or item.get("code")
    )

    market = (
        item.get("market") or item.get("mrktCtg") or item.get("market_name") or item.get("mktNm")
    )

    corp_code = item.get("corp_code") or item.get("corpCode")

    if not stock_code:
        raise ValueError(f"k-skill 응답에서 stock_code를 찾지 못했습니다: {item}")

    return CompanyInfo(
        corp_name=corp_name,
        stock_code=stock_code,
        corp_code=corp_code,
        market=market,
    )


def search_stock_from_kskill(keyword: str, bas_dd: str = DEFAULT_BAS_DD) -> CompanyInfo:
    """
    k-skill 종목 검색 API 호출.
    429가 날 수 있으므로 search_stock()에서 로컬 캐시와 함께 사용한다.
    """
    params = {
        "q": keyword,
        "bas_dd": bas_dd,
        "limit": 10,
    }

    response = requests.get(K_SKILL_SEARCH_URL, params=params, timeout=10)

    if response.status_code == 429:
        raise RuntimeError("k-skill API 요청 제한에 걸렸습니다. 로컬 캐시를 사용해야 합니다.")

    response.raise_for_status()
    data = response.json()

    items = data.get("items") or data.get("data") or data.get("results") or data.get("stocks") or []

    if isinstance(items, dict):
        items = [items]

    if not items:
        raise ValueError(f"k-skill에서 종목을 찾지 못했습니다: {keyword}")

    return parse_kskill_item(items[0], fallback_name=keyword)


def save_company_to_master(company: CompanyInfo) -> None:
    """
    k-skill로 찾은 종목을 로컬 stock_master.json에 저장한다.
    """
    stock_master = load_stock_master()

    stock_master[company.corp_name] = {
        "corp_name": company.corp_name,
        "stock_code": company.stock_code,
        "corp_code": company.corp_code,
        "market": company.market,
    }

    save_stock_master(stock_master)


def search_stock(keyword: str) -> CompanyInfo:
    """
    종목명 입력 → CompanyInfo 반환.

    안정화 전략:
    1. 메모리 캐시
    2. assets/stock_master.json
    3. k-skill API
    4. 성공 시 stock_master.json에 저장
    """
    keyword = normalize_keyword(keyword)

    if not keyword:
        raise ValueError("종목명이 비어 있습니다.")

    if keyword in SEARCH_CACHE:
        return SEARCH_CACHE[keyword]

    local_result = find_in_local_master(keyword)
    if local_result:
        SEARCH_CACHE[keyword] = local_result
        return local_result

    try:
        api_result = search_stock_from_kskill(keyword)
        SEARCH_CACHE[keyword] = api_result
        save_company_to_master(api_result)
        return api_result

    except Exception as e:
        raise RuntimeError(
            f"종목 검색 실패: {keyword}. "
            f"로컬 stock_master에도 없고 k-skill 호출도 실패했습니다. 원인: {str(e)}"
        )
