"""
DART corp_code 매핑 헬퍼.

OpenDART corpCode.xml ZIP을 내려받아 stock_code → corp_code 딕셔너리를 빌드하고
data/dart_corp_index.json 에 캐시한다. TTL 1일, 동시 호출 안전.
"""

from __future__ import annotations

import io
import json
import logging
import os
import threading
import time
import zipfile
from pathlib import Path

import requests
from dotenv import load_dotenv

load_dotenv()

logger = logging.getLogger(__name__)

PROJECT_ROOT = Path(__file__).resolve().parents[2]
CACHE_PATH = PROJECT_ROOT / "data" / "dart_corp_index.json"
CACHE_TTL_SECONDS = 86_400  # 1일

DART_CORP_CODE_URL = "https://opendart.fss.or.kr/api/corpCode.xml"

_lock = threading.Lock()
_index: dict[str, str] | None = None  # stock_code → corp_code
_loaded_at: float = 0.0


def _get_dart_api_key() -> str | None:
    return os.getenv("DART_API_KEY")


def _load_from_cache() -> dict[str, str] | None:
    """캐시 파일이 있고 TTL 내면 로드, 아니면 None."""
    if not CACHE_PATH.exists():
        return None
    try:
        mtime = CACHE_PATH.stat().st_mtime
        if time.time() - mtime > CACHE_TTL_SECONDS:
            logger.info("DART corp_index 캐시 만료 — 재다운로드 필요")
            return None
        with open(CACHE_PATH, "r", encoding="utf-8") as f:
            data = json.load(f)
        if isinstance(data, dict):
            logger.info("DART corp_index 캐시 로드: %d건", len(data))
            return data
    except Exception as exc:
        logger.warning("DART corp_index 캐시 읽기 실패: %s", exc)
    return None


def _save_to_cache(index: dict[str, str]) -> None:
    CACHE_PATH.parent.mkdir(parents=True, exist_ok=True)
    try:
        with open(CACHE_PATH, "w", encoding="utf-8") as f:
            json.dump(index, f, ensure_ascii=False)
        logger.info("DART corp_index 캐시 저장: %d건", len(index))
    except Exception as exc:
        logger.warning("DART corp_index 캐시 저장 실패: %s", exc)


def _fetch_from_dart() -> dict[str, str]:
    """OpenDART API 호출 → ZIP 파싱 → stock_code → corp_code 딕셔너리."""
    api_key = _get_dart_api_key()
    if not api_key:
        raise ValueError("DART_API_KEY 환경변수가 설정되지 않았습니다.")

    logger.info("DART corpCode.xml 다운로드 시작")
    resp = requests.get(
        DART_CORP_CODE_URL,
        params={"crtfc_key": api_key},
        timeout=30,
    )
    resp.raise_for_status()

    # ZIP 내 CORPCODE.xml 파싱
    with zipfile.ZipFile(io.BytesIO(resp.content)) as zf:
        xml_name = next((n for n in zf.namelist() if n.upper().endswith(".XML")), None)
        if xml_name is None:
            raise ValueError("DART ZIP에서 XML 파일을 찾지 못했습니다.")
        xml_bytes = zf.read(xml_name)

    # 표준 라이브러리 xml.etree 로 파싱
    import xml.etree.ElementTree as ET

    root = ET.fromstring(xml_bytes)
    index: dict[str, str] = {}
    for item in root.iter("list"):
        stock_code_el = item.find("stock_code")
        corp_code_el = item.find("corp_code")
        if stock_code_el is None or corp_code_el is None:
            continue
        sc = (stock_code_el.text or "").strip()
        cc = (corp_code_el.text or "").strip()
        if sc and cc:
            index[sc] = cc

    logger.info("DART corpCode.xml 파싱 완료: %d건", len(index))
    return index


def get_dart_corp_index() -> dict[str, str]:
    """stock_code → corp_code 딕셔너리를 반환한다. 캐시/TTL 관리 포함."""
    global _index, _loaded_at

    with _lock:
        # 메모리 캐시 유효 확인
        if _index is not None and (time.time() - _loaded_at) < CACHE_TTL_SECONDS:
            return _index

        # 파일 캐시 시도
        cached = _load_from_cache()
        if cached is not None:
            _index = cached
            _loaded_at = time.time()
            return _index

        # DART API 호출
        try:
            fetched = _fetch_from_dart()
            _save_to_cache(fetched)
            _index = fetched
            _loaded_at = time.time()
            return _index
        except Exception as exc:
            logger.error("DART corp_index 빌드 실패: %s", exc)
            # 실패 시 빈 딕셔너리 반환 (호출부에서 None으로 처리)
            return {}


def get_corp_code_by_stock_code(stock_code: str) -> str | None:
    """종목코드(6자리) → corp_code 반환. 없으면 None."""
    if not stock_code:
        return None
    index = get_dart_corp_index()
    result = index.get(stock_code.strip())
    if result is None:
        logger.info("DART 매핑 미스: stock_code=%s", stock_code)
    return result
