import json
from datetime import date, datetime, timedelta, timezone
from pathlib import Path
from statistics import mean
from typing import Any

import requests

from backend.schemas.bundle import DailyPriceVolume, PriceVolumeData

K_SKILL_TRADE_INFO_URL = "https://k-skill-proxy.nomadamas.org/v1/korean-stock/trade-info"

# k-skill-proxy 데이터셋의 최신 영업일. trade-info 엔드포인트는 bas_dd 1일만 받으므로
# 시세 히스토리는 이 날짜를 기준으로 과거 방향으로 하루씩 호출해서 모은다.
DEFAULT_BAS_DD = "20250516"

# 최근 며칠치(달력일 기준)를 수집할지. 주말·휴장일은 자동으로 건너뛴다.
DEFAULT_HISTORY_DAYS = 60


def get_latest_business_day_bas_dd() -> str:
    """KST 기준 현재 시각으로 가장 최근 영업일을 YYYYMMDD로 반환한다.

    - 15:30 KST 이전이면 전 영업일(당일 종가 미확정)
    - 토요일이면 금요일, 일요일이면 금요일
    """
    KST = timezone(timedelta(hours=9))
    now_kst = datetime.now(KST)

    cutoff_hour = 15
    cutoff_minute = 30

    # 15:30 KST 이전이면 어제부터 탐색
    if (now_kst.hour, now_kst.minute) < (cutoff_hour, cutoff_minute):
        candidate = now_kst.date() - timedelta(days=1)
    else:
        candidate = now_kst.date()

    # 주말이면 직전 금요일로
    while candidate.weekday() >= 5:  # 5=토, 6=일
        candidate -= timedelta(days=1)

    return candidate.strftime("%Y%m%d")


def fetch_latest_price(
    stock_code: str,
    market: str,
    timeout: float = 5.0,
) -> tuple[float | None, float | None]:
    """k-skill 프록시로 해당 종목의 최신 현재가·등락률을 조회한다.

    k-skill이 당일 데이터를 아직 갖고 있지 않으면(not_found) 전 영업일로
    최대 3회 폴백한다.

    Returns:
        (close_price, change_rate) — 실패·빈 응답이면 (None, None)
    """
    try:
        if market not in {"KOSPI", "KOSDAQ", "KONEX"}:
            return (None, None)

        start_date = datetime.strptime(get_latest_business_day_bas_dd(), "%Y%m%d").date()

        # not_found(데이터 미준비) 시 최대 3 영업일 전까지 폴백
        candidate = start_date
        for _ in range(3):
            bas_dd = candidate.strftime("%Y%m%d")
            params = {
                "market": market,
                "stock_code": stock_code,
                "bas_dd": bas_dd,
            }

            response = requests.get(K_SKILL_TRADE_INFO_URL, params=params, timeout=timeout)

            if response.status_code == 404:
                # 해당 날짜 데이터 없음 → 전 영업일로 폴백
                candidate -= timedelta(days=1)
                while candidate.weekday() >= 5:
                    candidate -= timedelta(days=1)
                continue

            if response.status_code != 200:
                return (None, None)

            data = response.json()

            # error 필드가 있으면 not_found로 간주하고 폴백
            if data.get("error"):
                candidate -= timedelta(days=1)
                while candidate.weekday() >= 5:
                    candidate -= timedelta(days=1)
                continue

            # 응답에는 item(단건) 또는 items[0] 형태로 온다
            item: dict[str, Any] | None = data.get("item")
            if item is None:
                items = data.get("items") or []
                item = items[0] if items else None

            if not item:
                return (None, None)

            close_price = item.get("close_price")
            change_rate = item.get("change_rate")

            if close_price is None and change_rate is None:
                return (None, None)

            return (
                float(close_price) if close_price is not None else None,
                float(change_rate) if change_rate is not None else None,
            )

        return (None, None)
    except Exception:
        return (None, None)


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


def iter_business_days(end_bas_dd: str, days_back: int) -> list[str]:
    """
    end_bas_dd 부터 과거 방향으로 days_back일을 훑으면서 평일(월~금)만 YYYYMMDD로 반환한다.
    공휴일·휴장일은 여기서 거를 수 없으므로 호출 측에서 not_found 응답을 무시한다.
    """
    end = date(int(end_bas_dd[:4]), int(end_bas_dd[4:6]), int(end_bas_dd[6:8]))

    business_days = []
    for offset in range(days_back):
        day = end - timedelta(days=offset)
        if day.weekday() >= 5:  # 5=토, 6=일
            continue
        business_days.append(day.strftime("%Y%m%d"))

    return business_days


def fetch_trade_info_history(
    stock_code: str,
    market: str,
    end_bas_dd: str = DEFAULT_BAS_DD,
    days_back: int = DEFAULT_HISTORY_DAYS,
    known_dates: set[str] | None = None,
) -> list[DailyPriceVolume]:
    """
    end_bas_dd 기준 최근 영업일들의 시세를 하루씩 호출해서 모은다.
    known_dates에 이미 있는 날짜는 호출을 건너뛰어 캐시 증분 수집이 되게 한다.
    """
    known_dates = known_dates or set()

    collected: list[DailyPriceVolume] = []
    for bas_dd in iter_business_days(end_bas_dd, days_back):
        if bas_dd in known_dates:
            continue

        try:
            collected.extend(fetch_trade_info_from_kskill(stock_code, market, bas_dd))
        except Exception:
            # 휴장일(not_found)·일시적 오류는 건너뛰고 나머지 날짜를 계속 수집한다.
            continue

    return collected


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
    2. 캐시에 없는 영업일만 k-skill trade-info로 증분 호출
    3. 캐시와 병합
    4. 지표 계산
    """

    cached_daily = load_price_cache(stock_code)

    fetched_daily = []

    if market:
        known_dates = {item.date for item in cached_daily}
        try:
            fetched_daily = fetch_trade_info_history(stock_code, market, known_dates=known_dates)
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
