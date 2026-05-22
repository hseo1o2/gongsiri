from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field

from backend.schemas.bundle import NormalizedDataBundle

ChecklistStatus = Literal["pass", "fail", "unknown"]
RiskLevel = Literal["normal", "caution", "high"]


class ChecklistEvidenceRef(BaseModel):
    label: str
    source: str
    observed_at: str | None = None


class ChecklistItem(BaseModel):
    id: str
    title: str
    status: ChecklistStatus
    score: int
    reason: str
    evidence: list[str] = Field(default_factory=list)
    evidence_refs: list[ChecklistEvidenceRef] = Field(default_factory=list)
    source: str = "deterministic_backend"
    observed_at: str | None = None
    solar_explanation: str = ""


class AnalysisResult(BaseModel):
    risk_score: int
    risk_level: RiskLevel
    checklist: list[ChecklistItem] = Field(default_factory=list)
    short_term_report: str
    long_term_report: str
    disclaimer: str
    missing_evidence: list[str] = Field(default_factory=list)


class PreparedPersistencePayload(BaseModel):
    trace_id: str
    trigger_source: str
    corp_code: str | None = None
    stock_code: str | None = None
    risk_score: int
    risk_level: RiskLevel
    report_ready: bool


class PreparedNotificationPayload(BaseModel):
    title: str
    body: str
    risk_level: RiskLevel
    trigger_source: str
    should_notify: bool


class PipelineResultData(BaseModel):
    normalized_data_bundle: NormalizedDataBundle
    analysis_result: AnalysisResult
    preparation: dict[str, PreparedPersistencePayload | PreparedNotificationPayload]
