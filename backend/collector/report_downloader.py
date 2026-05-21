import hashlib
import re
from pathlib import Path
from urllib.parse import urlparse

import requests


def safe_filename(text: str | None) -> str:
    if not text:
        return "report"

    text = re.sub(r"[\\/:*?\"<>|]", "_", text)
    text = re.sub(r"\s+", "_", text)
    text = text.strip("_")

    return text[:80] or "report"


def is_pdf_url(url: str) -> bool:
    parsed = urlparse(url)
    return parsed.path.lower().endswith(".pdf")


def is_valid_pdf_content(content: bytes) -> bool:
    return content.startswith(b"%PDF")


def build_report_filename(url: str, title: str | None = None) -> str:
    url_hash = hashlib.md5(url.encode("utf-8")).hexdigest()[:8]
    base = safe_filename(title)
    return f"{base}_{url_hash}.pdf"


def download_pdf_report(
    url: str,
    title: str | None = None,
    output_dir: str = "data/reports",
) -> str | None:
    """
    PDF 직접 링크만 다운로드한다.
    HTML/가짜 PDF/깨진 파일은 저장하지 않는다.
    """

    if not url or not is_pdf_url(url):
        return None

    output_path = Path(output_dir)
    output_path.mkdir(parents=True, exist_ok=True)

    filename = build_report_filename(url, title)
    file_path = output_path / filename

    if file_path.exists():
        with open(file_path, "rb") as f:
            head = f.read(4)

        if head == b"%PDF":
            return str(file_path)

        file_path.unlink(missing_ok=True)

    headers = {
        "User-Agent": "Mozilla/5.0",
        "Accept": "application/pdf,*/*",
    }

    response = requests.get(
        url,
        headers=headers,
        timeout=30,
        allow_redirects=True,
    )
    response.raise_for_status()

    content = response.content

    if not is_valid_pdf_content(content):
        return None

    with open(file_path, "wb") as f:
        f.write(content)

    return str(file_path)


def download_pdf_reports_from_candidates(candidates: list[dict]) -> list[str]:
    """
    후보 중 is_pdf=True 또는 pdf_url이 있는 항목만 다운로드한다.
    """

    downloaded_files = []

    for item in candidates:
        url = item.get("pdf_url") or item.get("url")
        title = item.get("title")
        is_pdf = item.get("is_pdf", False)

        if not url:
            continue

        if not is_pdf and not is_pdf_url(url):
            continue

        try:
            file_path = download_pdf_report(url, title=title)

            if file_path:
                downloaded_files.append(file_path)

        except Exception:
            continue

    return downloaded_files
