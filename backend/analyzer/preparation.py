from __future__ import annotations

from backend.schemas.analysis import (
    AnalysisResult,
    PreparedNotificationPayload,
    PreparedPersistencePayload,
)
from backend.schemas.bundle import NormalizedDataBundle


def build_persistence_payload(
    bundle: NormalizedDataBundle,
    analysis_result: AnalysisResult,
    *,
    trace_id: str,
    trigger_source: str,
) -> PreparedPersistencePayload:
    return PreparedPersistencePayload(
        trace_id=trace_id,
        trigger_source=trigger_source,
        corp_code=bundle.company.corp_code,
        stock_code=bundle.company.stock_code,
        risk_score=analysis_result.risk_score,
        risk_level=analysis_result.risk_level,
        report_ready=bool(analysis_result.short_term_report and analysis_result.long_term_report),
    )


def build_notification_payload(
    bundle: NormalizedDataBundle,
    analysis_result: AnalysisResult,
    *,
    trigger_source: str,
) -> PreparedNotificationPayload:
    return PreparedNotificationPayload(
        title=f"[공시리] {bundle.company.corp_name} 위험도 {analysis_result.risk_level}",
        body=analysis_result.short_term_report,
        risk_level=analysis_result.risk_level,
        trigger_source=trigger_source,
        should_notify=analysis_result.risk_level in {"caution", "high"},
    )
