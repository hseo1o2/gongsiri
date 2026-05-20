import json
from pathlib import Path
from statistics import mean
from typing import Any

import requests

from backend.schemas.bundle import DailyPriceVolume, PriceVolumeData

K_SKILL_TRADE_INFO_URL = "https://k-skill-proxy.nomadamas.org/v1/korean-stock/trade-info"
DEFAULT_BAS_DD = "20250516"

PROJECT_ROOT = Path(__file__).resolve().parents[3]
PRICE_CACHE_DIR = PROJECT_ROOT / "data" / "price_cache"


def get_cache_path(stock_code: str) -> Path:
    PRICE_CACHE_DIR.mkdir(parents=True, exist_ok=True)
    return PRICE_CACHE_DIR / f"{stock_code}.json"


def load_price_cache(stock_code: str) -> list[DailyPriceVolume]:
    cache_path = get_cache_path(stock_code)

    if not cache_path.exists():
        return []

    try:
        with open(cache_path, "r", encoding="utf-8") as f:
            raw_data = json.load(f)

        return [DailyPriceVolume(**item) for item in raw_data]

    except Exception:
        return []


def save_price_cache(stock_code: str, daily_data: list[DailyPriceVolume]) -> None:
    cache_path = get_cache_path(stock_code)

    serialized = [item.model_dump() for item in daily_data]

    with open(cache_path, "w", encoding="utf-8") as f:
        json.dump(serialized, f, ensure_ascii=False, indent=2)


def normalize_number(value: Any) -> float:
    if value is None:
        return 0.0

    if isinstance(value, (int, float)):
        return float(value)

    cleaned = str(value).replace(",", "").strip()

    if cleaned in ("", "-", "N/A", "null", "None"):
        return 0.0

    return float(cleaned)


def parse_trade_item(item: dict[str, Any]) -> DailyPriceVolume:
    date = (
        item.get("date")
        or item.get("basDd")
        or item.get("bas_dd")
        or item.get("trdDd")
        or item.get("bas_dd")
        or DEFAULT_BAS_DD
    )

    close = (
        item.get("close")
        or item.get("clpr")
        or item.get("tddClsprc")
        or item.get("closing_price")
        or item.get("close_price")
        or 0
    )

    volume = (
        item.get("volume")
        or item.get("trqu")
        or item.get("accTrdvol")
        or item.get("trading_volume")
        or item.get("acc_trdvol")
        or 0
    )

    return DailyPriceVolume(
        date=str(date).replace("-", ""),
        close=normalize_number(close),
        volume=int(normalize_number(volume)),
    )


def fetch_trade_info_from_kskill(
    stock_code: str,
    market: str,
    bas_dd: str = DEFAULT_BAS_DD,
) -> list[DailyPriceVolume]:
    """
    k-skill trade-info API 호출.
    필수 파라미터:
    - market: KOSPI / KOSDAQ / KONEX
    - stock_code
    - bas_dd
    """

    if market not in {"KOSPI", "KOSDAQ", "KONEX"}:
        raise ValueError(f"market 값이 올바르지 않습니다: {market}")

    params = {
        "market": market,
        "stock_code": stock_code,
        "bas_dd": bas_dd,
    }

    response = requests.get(
        K_SKILL_TRADE_INFO_URL,
        params=params,
        timeout=10,
    )

    if response.status_code == 429:
        raise RuntimeError("k-skill trade-info API 요청 제한에 걸렸습니다.")

    if response.status_code == 400:
        raise RuntimeError(f"k-skill trade-info 요청 오류: {response.text}")

    response.raise_for_status()
    data = response.json()

    raw_items = (
        data.get("daily") or data.get("items") or data.get("data") or data.get("results") or []
    )

    if isinstance(raw_items, dict):
        raw_items = [raw_items]

    if not raw_items and isinstance(data, dict):
        raw_items = [data]

    daily_data = []

    for item in raw_items:
        try:
            daily_data.append(parse_trade_item(item))
        except Exception:
            continue

    return daily_data


def merge_daily_data(
    old_data: list[DailyPriceVolume],
    new_data: list[DailyPriceVolume],
) -> list[DailyPriceVolume]:
    merged: dict[str, DailyPriceVolume] = {}

    for item in old_data:
        merged[item.date] = item

    for item in new_data:
        merged[item.date] = item

    return sorted(merged.values(), key=lambda x: x.date)


def calculate_monthly_return_max(daily_data: list[DailyPriceVolume]) -> float | None:
    if len(daily_data) < 2:
        return None

    sorted_data = sorted(daily_data, key=lambda x: x.date)

    monthly_groups: dict[str, list[DailyPriceVolume]] = {}

    for item in sorted_data:
        month = item.date[:6]
        monthly_groups.setdefault(month, []).append(item)

    monthly_returns = []

    for items in monthly_groups.values():
        if len(items) < 2:
            continue

        first_price = items[0].close
        last_price = items[-1].close

        if first_price == 0:
            continue

        monthly_return = ((last_price - first_price) / first_price) * 100
        monthly_returns.append(monthly_return)

    if not monthly_returns:
        return None

    return round(max(monthly_returns), 2)


def calculate_volume_spike_ratio(daily_data: list[DailyPriceVolume]) -> float | None:
    if len(daily_data) < 2:
        return None

    sorted_data = sorted(daily_data, key=lambda x: x.date)

    recent_volume = sorted_data[-1].volume
    previous_volumes = [item.volume for item in sorted_data[:-1] if item.volume > 0]

    if not previous_volumes:
        return None

    avg_previous_volume = mean(previous_volumes)

    if avg_previous_volume == 0:
        return None

    return round(recent_volume / avg_previous_volume, 2)


def get_trade_info(stock_code: str, market: str | None = None) -> PriceVolumeData:
    """
    최종 시세·거래량 수집 함수.

    처리 순서:
    1. 기존 price_cache 로드
    2. k-skill trade-info 호출
    3. 캐시와 병합
    4. 지표 계산
    """

    cached_daily = load_price_cache(stock_code)

    fetched_daily = []

    if market:
        try:
            fetched_daily = fetch_trade_info_from_kskill(stock_code, market)
        except Exception:
            fetched_daily = []

    daily_data = merge_daily_data(cached_daily, fetched_daily)

    if daily_data:
        save_price_cache(stock_code, daily_data)

    return PriceVolumeData(
        daily=daily_data,
        monthly_return_max=calculate_monthly_return_max(daily_data),
        volume_spike_ratio=calculate_volume_spike_ratio(daily_data),
    )
