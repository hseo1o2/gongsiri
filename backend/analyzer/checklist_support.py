from __future__ import annotations

from collections.abc import Iterable

from backend.schemas.analysis import ChecklistEvidenceRef
from backend.schemas.bundle import DisclosureItem, NewsDocument, NormalizedDataBundle


def find_matching_disclosures(
    bundle: NormalizedDataBundle, *, terms: tuple[str, ...]
) -> list[DisclosureItem]:
    matches: list[DisclosureItem] = []
    for disclosure in bundle.disclosures:
        haystack = " ".join(
            [disclosure.report_nm, disclosure.category or "", disclosure.parsed_text or ""]
        )
        if any(term in haystack for term in terms):
            matches.append(disclosure)
    return matches


def find_hot_theme_mentions(
    bundle: NormalizedDataBundle, *, keywords: tuple[str, ...]
) -> list[NewsDocument]:
    mentions: list[NewsDocument] = []
    for news in bundle.news_docs:
        haystack = f"{news.title} {news.body}"
        if any(keyword in haystack for keyword in keywords):
            mentions.append(news)
    return mentions


def latest_date(values: Iterable[str | None]) -> str | None:
    dates = [value for value in values if value]
    return max(dates) if dates else None


def disclosure_refs(disclosures: list[DisclosureItem]) -> list[ChecklistEvidenceRef]:
    return [
        ChecklistEvidenceRef(
            label=disclosure.report_nm,
            source="dart_disclosure",
            observed_at=disclosure.rcept_dt,
        )
        for disclosure in disclosures[:3]
    ]


def news_refs(news_docs: list[NewsDocument]) -> list[ChecklistEvidenceRef]:
    return [
        ChecklistEvidenceRef(label=news.title, source="naver_news", observed_at=news.date)
        for news in news_docs[:3]
    ]


def price_refs(
    bundle: NormalizedDataBundle, *, price_signal: float, volume_signal: float
) -> list[ChecklistEvidenceRef]:
    observed_at = latest_date(item.date for item in bundle.price_volume.daily)
    return [
        ChecklistEvidenceRef(
            label=f"monthly_return_max={price_signal}",
            source="krx_trade_info",
            observed_at=observed_at,
        ),
        ChecklistEvidenceRef(
            label=f"volume_spike_ratio={volume_signal}",
            source="krx_trade_info",
            observed_at=observed_at,
        ),
    ]


def financial_refs(
    bundle: NormalizedDataBundle, *, price_signal: float
) -> list[ChecklistEvidenceRef]:
    return [
        ChecklistEvidenceRef(
            label=f"revenue={bundle.financials.revenue}",
            source="financial_statement",
        ),
        ChecklistEvidenceRef(
            label=f"operating_income={bundle.financials.operating_income}",
            source="financial_statement",
        ),
        ChecklistEvidenceRef(
            label=f"monthly_return_max={price_signal}",
            source="krx_trade_info",
            observed_at=latest_date(item.date for item in bundle.price_volume.daily),
        ),
    ]
