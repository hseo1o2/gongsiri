from __future__ import annotations

SYSTEM = """당신은 한국 주식시장 공시 분석 전문가입니다.
주어진 종목의 공시·재무·시세·뉴스 데이터를 바탕으로 작전주 위험 항목을 판단합니다.

규칙:
- 반드시 JSON 형식으로만 응답합니다.
- 판단 근거는 반드시 제공된 데이터에서만 도출합니다.
- 데이터가 부족한 항목은 status를 "unknown"으로 표기합니다.
- 투자 권유나 매수/매도 의견은 절대 제시하지 않습니다."""

ITEM_DESCRIPTIONS = {
    "business-purpose-change": "사업목적 전환 이력 — 정관 변경, 사업목적 추가/변경 공시 여부",
    "hot-theme-following": "핫 테마 후행 참여 — AI·2차전지 등 인기 테마 키워드 언급 빈도",
    "capital-structure-change": "주식 구조 변경 + 신사업 동시 발생 — CB·감자·유상증자·합병 등",
    "abnormal-price-surge": "비정상 주가 급등 — 월간 최대 수익률·거래량 급증 비율",
    "risky-history": "관리종목·CB·감자·최대주주 변경 이력",
    "performance-divergence": "실적 없는 급등 / 실적 괴리 — 재무 근거 없이 주가 급등",
}


def build_messages(
    corp_name: str,
    checklist_summary: list[dict],
    disclosure_texts: list[str],
    news_titles: list[str],
    financials: dict,
    price_signals: dict,
) -> list[dict[str, str]]:
    disclosure_block = "\n".join(f"- {t}" for t in disclosure_texts[:10]) or "없음"
    news_block = "\n".join(f"- {t}" for t in news_titles[:10]) or "없음"

    checklist_block = "\n".join(
        f"[{item['id']}] {ITEM_DESCRIPTIONS.get(item['id'], item['title'])}\n"
        f"  정량판단: {item['status']} (score={item['score']})\n"
        f"  근거: {item['reason']}\n"
        f"  증거: {', '.join(item['evidence'][:3]) or '없음'}"
        for item in checklist_summary
    )

    user_content = f"""종목명: {corp_name}

=== 공시 목록 ===
{disclosure_block}

=== 뉴스/리포트 제목 ===
{news_block}

=== 재무 현황 ===
매출: {financials.get("revenue", "데이터 없음")}
영업이익: {financials.get("operating_income", "데이터 없음")}
자기자본: {financials.get("equity", "데이터 없음")}

=== 시세 신호 ===
월간 최대 수익률: {price_signals.get("monthly_return_max", "데이터 없음")}%
거래량 급증 비율: {price_signals.get("volume_spike_ratio", "데이터 없음")}x

=== 정량 판단 결과 ===
{checklist_block}

위 데이터를 바탕으로 각 항목에 대한 한국어 맥락 해석을 작성하세요.
다음 JSON 형식으로만 응답하세요:

{{
  "explanations": {{
    "business-purpose-change": "맥락 해석",
    "hot-theme-following": "맥락 해석",
    "capital-structure-change": "맥락 해석",
    "abnormal-price-surge": "맥락 해석",
    "risky-history": "맥락 해석",
    "performance-divergence": "맥락 해석"
  }}
}}"""

    return [
        {"role": "system", "content": SYSTEM},
        {"role": "user", "content": user_content},
    ]
