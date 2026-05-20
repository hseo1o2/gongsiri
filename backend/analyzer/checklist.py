from __future__ import annotations

from backend.schemas.analysis import ChecklistItem, RiskLevel
from backend.schemas.bundle import NormalizedDataBundle

HOT_THEME_KEYWORDS = ("AI", "2차전지", "메타버스", "로봇", "우주", "양자", "바이오")
STRUCTURE_CHANGE_CATEGORIES = {
    "convertible_bond",
    "bond_with_warrant",
    "paid_in_capital_increase",
    "capital_reduction",
    "largest_shareholder_change",
    "merger",
    "spin_off",
}


def _find_matching_disclosures(
    bundle: NormalizedDataBundle, *, terms: tuple[str, ...]
) -> list[str]:
    matches: list[str] = []

    for disclosure in bundle.disclosures:
        haystack = " ".join(
            [disclosure.report_nm, disclosure.category or "", disclosure.parsed_text or ""]
        )
        if any(term in haystack for term in terms):
            matches.append(disclosure.report_nm)

    return matches


def _find_hot_theme_mentions(bundle: NormalizedDataBundle) -> list[str]:
    mentions: list[str] = []

    for news in bundle.news_docs:
        haystack = f"{news.title} {news.body}"
        if any(keyword in haystack for keyword in HOT_THEME_KEYWORDS):
            mentions.append(news.title)

    return mentions


def build_checklist(bundle: NormalizedDataBundle) -> list[ChecklistItem]:
    business_purpose_matches = _find_matching_disclosures(bundle, terms=("사업목적", "정관"))
    hot_theme_mentions = _find_hot_theme_mentions(bundle)
    structure_change_matches = [
        disclosure.report_nm
        for disclosure in bundle.disclosures
        if (disclosure.category or "") in STRUCTURE_CHANGE_CATEGORIES
    ]
    price_signal = bundle.price_volume.monthly_return_max or 0
    volume_signal = bundle.price_volume.volume_spike_ratio or 0
    financial_missing = (
        bundle.financials.revenue is None
        and bundle.financials.operating_income is None
        and bundle.financials.equity is None
    )

    checklist: list[ChecklistItem] = [
        ChecklistItem(
            id="business-purpose-change",
            title="사업목적 전환 이력",
            status="fail" if business_purpose_matches else "pass",
            score=1 if business_purpose_matches else 0,
            reason="사업목적/정관 변경 관련 공시가 감지되었습니다."
            if business_purpose_matches
            else "사업목적 변경 관련 징후가 감지되지 않았습니다.",
            evidence=business_purpose_matches[:3],
        ),
        ChecklistItem(
            id="hot-theme-following",
            title="핫 테마 후행 참여",
            status=(
                "fail"
                if len(hot_theme_mentions) >= 2
                else ("unknown" if not bundle.news_docs else "pass")
            ),
            score=1 if len(hot_theme_mentions) >= 2 else 0,
            reason="핫 테마 키워드가 반복적으로 언급되었습니다."
            if len(hot_theme_mentions) >= 2
            else (
                "뉴스 근거가 부족합니다."
                if not bundle.news_docs
                else "테마 후행 참여 징후가 약합니다."
            ),
            evidence=hot_theme_mentions[:3],
        ),
        ChecklistItem(
            id="capital-structure-change",
            title="주식 구조 변경 + 신사업 동시 발생",
            status="fail" if structure_change_matches else "pass",
            score=1 if structure_change_matches else 0,
            reason="자본/지배구조 관련 공시가 감지되었습니다."
            if structure_change_matches
            else "구조 변경 징후가 감지되지 않았습니다.",
            evidence=structure_change_matches[:3],
        ),
        ChecklistItem(
            id="abnormal-price-surge",
            title="비정상 주가 급등",
            status="fail"
            if price_signal >= 50 or volume_signal >= 3
            else ("unknown" if not bundle.price_volume.daily else "pass"),
            score=1 if price_signal >= 50 or volume_signal >= 3 else 0,
            reason="가격/거래량 급등 신호가 임계값을 넘었습니다."
            if price_signal >= 50 or volume_signal >= 3
            else (
                "시세 근거가 부족합니다."
                if not bundle.price_volume.daily
                else "가격/거래량 급등이 임계값 미만입니다."
            ),
            evidence=[
                f"monthly_return_max={price_signal}",
                f"volume_spike_ratio={volume_signal}",
            ],
        ),
        ChecklistItem(
            id="risky-history",
            title="관리종목·CB·감자·최대주주 변경 이력",
            status="fail"
            if structure_change_matches
            else ("unknown" if not bundle.disclosures else "pass"),
            score=1 if structure_change_matches else 0,
            reason="위험 이력 성격의 공시 카테고리가 감지되었습니다."
            if structure_change_matches
            else (
                "공시 근거가 부족합니다."
                if not bundle.disclosures
                else "위험 이력 공시가 감지되지 않았습니다."
            ),
            evidence=structure_change_matches[:3],
        ),
        ChecklistItem(
            id="performance-divergence",
            title="실적 없는 급등 / 실적 괴리",
            status="fail"
            if financial_missing and (price_signal >= 30 or volume_signal >= 2)
            else ("unknown" if financial_missing else "pass"),
            score=1 if financial_missing and (price_signal >= 30 or volume_signal >= 2) else 0,
            reason="재무 근거 부족 상태에서 급등 신호가 함께 감지되었습니다."
            if financial_missing and (price_signal >= 30 or volume_signal >= 2)
            else (
                "재무 근거가 부족합니다."
                if financial_missing
                else "재무/가격 괴리 징후가 약합니다."
            ),
            evidence=[
                f"revenue={bundle.financials.revenue}",
                f"operating_income={bundle.financials.operating_income}",
                f"monthly_return_max={price_signal}",
            ],
        ),
    ]

    return checklist


def calculate_risk_score(checklist: list[ChecklistItem]) -> int:
    return sum(item.score for item in checklist)


def classify_risk_level(risk_score: int) -> RiskLevel:
    if risk_score >= 4:
        return "high"
    if risk_score >= 2:
        return "caution"
    return "normal"
