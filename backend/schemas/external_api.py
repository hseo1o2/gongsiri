from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field

ExternalAvailability = Literal["available", "degraded", "unavailable"]


class ExternalApiError(BaseModel):
    code: str
    message: str


class ExternalApiEvidence(BaseModel):
    source: str
    detail: str | None = None


class ExternalApiEnvelope(BaseModel):
    ok: bool
    source_id: str
    availability: ExternalAvailability
    evidence: list[ExternalApiEvidence] = Field(default_factory=list)
    error: ExternalApiError | None = None


class ExternalApiRegistryRow(BaseModel):
    source_id: str
    owner: str
    endpoint: str
    env_vars: list[str] = Field(default_factory=list)
    freshness: str
    rate_policy: str
    error_codes: list[str] = Field(default_factory=list)
    output_schema: str
    reasoning_boundary: str
    distillation_note: str


class StockSearchResult(BaseModel):
    corp_name: str
    stock_code: str
    corp_code: str | None = None
    market: str | None = None


class TradeInfoSnapshot(BaseModel):
    stock_code: str
    market: str
    monthly_return_max: float | None = None
    volume_spike_ratio: float | None = None
    latest_date: str | None = None


class NewsArticle(BaseModel):
    title: str
    source: str
    url: str | None = None
    published_at: str
    query: str
    matched_theme: str | None = None
    summary: str


class DartFilingEvidence(BaseModel):
    rcept_no: str
    report_nm: str
    rcept_dt: str
    category: str | None = None
    url: str | None = None


class FinancialSnapshot(BaseModel):
    revenue: float | None = None
    operating_income: float | None = None
    equity: float | None = None


class ExternalResearchReport(BaseModel):
    source_url: str | None = None
    parsed_sections: list[str] = Field(default_factory=list)
    extracted_tables: list[str] = Field(default_factory=list)
    key_points: list[str] = Field(default_factory=list)
