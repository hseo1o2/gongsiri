import json
import logging
from pathlib import Path
from typing import Any

import requests

from backend.collector.dart_corp_index import get_corp_code_by_stock_code
from backend.schemas.bundle import CompanyInfo

logger = logging.getLogger(__name__)

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


def load_stock_master(*, create_if_missing: bool = True) -> dict[str, dict[str, Any]]:
    """
    로컬 종목 마스터 파일을 읽는다.
    """
    if create_if_missing:
        ensure_stock_master_file()
    elif not STOCK_MASTER_PATH.exists():
        return DEFAULT_LOCAL_STOCKS.copy()

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


def find_in_local_master(keyword: str, *, create_if_missing: bool = True) -> CompanyInfo | None:
    """
    stock_master.json에서 먼저 종목을 찾는다.
    정확히 일치하는 종목명을 우선 사용한다.
    """
    keyword = normalize_keyword(keyword)
    stock_master = load_stock_master(create_if_missing=create_if_missing)

    if keyword in stock_master:
        return CompanyInfo(**stock_master[keyword])

    # 부분 검색 보조: 사용자가 '카카'처럼 입력한 경우도 대응
    for name, info in stock_master.items():
        if keyword and keyword in name:
            return CompanyInfo(**info)

    return None


def find_by_corp_code(corp_code: str, *, create_if_missing: bool = True) -> CompanyInfo | None:
    normalized = corp_code.strip()

    if not normalized:
        return None

    stock_master = load_stock_master(create_if_missing=create_if_missing)

    for info in stock_master.values():
        if info.get("corp_code") == normalized:
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


def search_stock(keyword: str, *, persist_result: bool = True) -> CompanyInfo:
    """
    종목명 입력 → CompanyInfo 반환.

    안정화 전략:
    1. 메모리 캐시
    2. assets/stock_master.json
    3. k-skill API
    4. 성공 시 필요할 때만 stock_master.json에 저장
    """
    keyword = normalize_keyword(keyword)

    if not keyword:
        raise ValueError("종목명이 비어 있습니다.")

    if keyword in SEARCH_CACHE:
        return SEARCH_CACHE[keyword]

    local_result = find_in_local_master(keyword, create_if_missing=persist_result)
    if local_result:
        SEARCH_CACHE[keyword] = local_result
        return local_result

    try:
        api_result = search_stock_from_kskill(keyword)
        SEARCH_CACHE[keyword] = api_result
        if persist_result:
            save_company_to_master(api_result)
        return api_result

    except Exception as e:
        raise RuntimeError(
            f"종목 검색 실패: {keyword}. "
            f"로컬 stock_master에도 없고 k-skill 호출도 실패했습니다. 원인: {str(e)}"
        )


def resolve_company_read_only(keyword: str) -> CompanyInfo:
    """
    Pi 런타임용 읽기 전용 종목 해석.

    - tracked asset(`assets/stock_master.json`)을 생성/수정하지 않는다.
    - 원격 조회가 성공해도 결과를 파일에 persist 하지 않는다.
    """
    return search_stock(keyword, persist_result=False)


def _enrich_corp_code(company: CompanyInfo) -> CompanyInfo | None:
    """corp_code가 없는 CompanyInfo에 DART 매핑으로 채운다. 채울 수 없으면 None."""
    if company.corp_code:
        return company
    mapped = get_corp_code_by_stock_code(company.stock_code)
    if mapped is None:
        logger.info("corp_code 매핑 실패로 제외: %s (%s)", company.corp_name, company.stock_code)
        return None
    return CompanyInfo(
        corp_name=company.corp_name,
        stock_code=company.stock_code,
        corp_code=mapped,
        market=company.market,
    )


def _search_kskill_multi(keyword: str, bas_dd: str = DEFAULT_BAS_DD) -> list[CompanyInfo]:
    """
    K-Skill 검색 결과 다건을 CompanyInfo 리스트로 반환한다.
    타임아웃 5초, 실패 시 빈 리스트.
    """
    params = {"q": keyword, "bas_dd": bas_dd, "limit": 10}
    try:
        logger.info("K-Skill 호출: q=%s", keyword)
        response = requests.get(K_SKILL_SEARCH_URL, params=params, timeout=5)
        if response.status_code == 429:
            logger.warning("K-Skill 429 rate limit")
            return []
        response.raise_for_status()
        data = response.json()
        items = (
            data.get("items") or data.get("data") or data.get("results") or data.get("stocks") or []
        )
        if isinstance(items, dict):
            items = [items]
        results: list[CompanyInfo] = []
        for item in items:
            try:
                results.append(parse_kskill_item(item, fallback_name=keyword))
            except ValueError:
                continue
        return results
    except Exception as exc:
        logger.info("K-Skill 호출 실패: %s", exc)
        return []


def resolve_companies(q: str) -> list[CompanyInfo]:
    """
    검색어 q에 매칭되는 CompanyInfo 리스트를 반환한다.

    전략:
    1. 로컬 마스터에서 부분 매칭 — corp_code 있으면 즉시 포함.
    2. K-Skill API 다건 조회 — corp_code 없는 항목은 DART 매핑으로 채움.
    3. corp_code가 null인 항목은 결과에서 제외.
    """
    keyword = normalize_keyword(q)
    if not keyword:
        return []

    seen_codes: set[str] = set()
    results: list[CompanyInfo] = []

    # 1단계: 로컬 마스터
    stock_master = load_stock_master(create_if_missing=False)
    for name, info in stock_master.items():
        corp_name = str(info.get("corp_name") or name)
        stock_code = str(info.get("stock_code") or "")
        corp_code = info.get("corp_code") or None
        market = info.get("market") or None

        haystack = f"{corp_name} {stock_code}".lower()
        if keyword.lower() not in haystack:
            continue

        if not corp_code:
            corp_code = get_corp_code_by_stock_code(stock_code)
        if not corp_code:
            logger.info("로컬 마스터 corp_code 미보유 — 제외: %s", corp_name)
            continue

        if stock_code not in seen_codes:
            seen_codes.add(stock_code)
            results.append(
                CompanyInfo(
                    corp_name=corp_name,
                    stock_code=stock_code,
                    corp_code=corp_code,
                    market=market,
                )
            )
        logger.info("로컬 히트: %s (%s)", corp_name, stock_code)

    # 2단계: K-Skill API
    if len(results) < 10:
        kskill_results = _search_kskill_multi(keyword)
        for company in kskill_results:
            if company.stock_code in seen_codes:
                continue
            enriched = _enrich_corp_code(company)
            if enriched is None:
                continue
            seen_codes.add(enriched.stock_code)
            results.append(enriched)

    return results[:10]
