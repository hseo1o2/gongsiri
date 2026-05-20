from backend.collector.krx.search import find_in_local_master, search_stock_from_kskill
from backend.schemas.bundle import CompanyInfo


def resolve_company_read_only(keyword: str) -> CompanyInfo:
    normalized = keyword.strip()

    if not normalized:
        raise ValueError("종목명이 비어 있습니다.")

    local_result = find_in_local_master(normalized)
    if local_result:
        return local_result

    try:
        return search_stock_from_kskill(normalized)
    except Exception as exc:  # pragma: no cover - exact upstream failure text is non-deterministic
        raise RuntimeError(
            f"종목 검색 실패: {normalized}. 읽기 전용 corp code 해석에 실패했습니다. 원인: {exc}"
        ) from exc
