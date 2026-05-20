import os
from pathlib import Path
from typing import Any

import requests
from dotenv import load_dotenv

from backend.schemas.bundle import ParsedReport

load_dotenv()

UPSTAGE_API_KEY = os.getenv("UPSTAGE_API_KEY")

UPSTAGE_DOCUMENT_PARSE_URL = "https://api.upstage.ai/v1/document-ai/document-parse"


def parse_document_with_upstage(file_path: str) -> dict[str, Any]:
    """
    Upstage Document Parse API로 PDF/이미지/문서를 구조화한다.
    반환 결과는 API 원본 JSON 그대로 반환한다.
    """

    if not UPSTAGE_API_KEY:
        raise ValueError("UPSTAGE_API_KEY가 .env에 없습니다.")

    path = Path(file_path)

    if not path.exists():
        raise FileNotFoundError(f"파일을 찾을 수 없습니다: {file_path}")

    headers = {
        "Authorization": f"Bearer {UPSTAGE_API_KEY}",
    }

    with open(path, "rb") as f:
        files = {
            "document": (path.name, f),
        }

        response = requests.post(
            UPSTAGE_DOCUMENT_PARSE_URL,
            headers=headers,
            files=files,
            timeout=60,
        )

    if response.status_code >= 400:
        raise RuntimeError(
            f"Upstage Document Parse API error: {response.status_code} / {response.text}"
        )

    return response.json()


def extract_markdown_from_response(result: dict[str, Any]) -> str:
    """
    Upstage 응답에서 Markdown/HTML/text 계열 결과를 최대한 유연하게 추출한다.
    실제 응답 포맷 차이에 대응하기 위한 방어적 파서.
    """

    if not result:
        return ""

    # 1. 최상위 markdown
    if isinstance(result.get("markdown"), str):
        return result["markdown"]

    # 2. 최상위 text
    if isinstance(result.get("text"), str):
        return result["text"]

    # 3. pages 내부
    pages = result.get("pages")
    if isinstance(pages, list):
        chunks = []

        for page in pages:
            if not isinstance(page, dict):
                continue

            if isinstance(page.get("markdown"), str):
                chunks.append(page["markdown"])
            elif isinstance(page.get("text"), str):
                chunks.append(page["text"])
            elif isinstance(page.get("html"), str):
                chunks.append(page["html"])

        if chunks:
            return "\n\n".join(chunks)

    # 4. elements 내부
    elements = result.get("elements")
    if isinstance(elements, list):
        chunks = []

        for element in elements:
            if not isinstance(element, dict):
                continue

            content = element.get("content") or element.get("text") or element.get("html") or ""

            if content:
                chunks.append(str(content))

        if chunks:
            return "\n\n".join(chunks)

    # 5. fallback
    return str(result)


def parse_local_report_file(
    file_path: str,
    source: str | None = None,
) -> ParsedReport:
    """
    로컬 PDF/이미지/문서 파일 1개를 Upstage로 파싱해 ParsedReport로 변환한다.
    """

    result = parse_document_with_upstage(file_path)
    parsed_text = extract_markdown_from_response(result)

    return ParsedReport(
        source=source or f"UPSTAGE:{Path(file_path).name}",
        parsed_text=parsed_text[:10000],
    )


def parse_local_report_files(
    file_paths: list[str],
    limit: int = 3,
) -> list[ParsedReport]:
    """
    여러 문서 파일을 Upstage Document Parse로 처리한다.
    """

    parsed_reports = []

    for file_path in file_paths[:limit]:
        try:
            parsed_reports.append(parse_local_report_file(file_path))
        except Exception as e:
            parsed_reports.append(
                ParsedReport(
                    source=f"UPSTAGE_ERROR:{Path(file_path).name}",
                    parsed_text=f"Document Parse 실패: {str(e)}",
                )
            )

    return parsed_reports
