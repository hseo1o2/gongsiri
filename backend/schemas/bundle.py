from typing import List, Optional

from pydantic import BaseModel, Field


class CompanyInfo(BaseModel):
    corp_name: str
    stock_code: str
    corp_code: Optional[str] = None
    market: Optional[str] = None


class DisclosureItem(BaseModel):
    rcept_no: str
    report_nm: str
    rcept_dt: str
    parsed_text: Optional[str] = None
    url: Optional[str] = None
    category: Optional[str] = None


class FinancialData(BaseModel):
    revenue: Optional[float] = None
    operating_income: Optional[float] = None
    equity: Optional[float] = None
    market_cap: Optional[float] = None


class DailyPriceVolume(BaseModel):
    date: str
    close: float
    volume: int


class PriceVolumeData(BaseModel):
    daily: List[DailyPriceVolume] = Field(default_factory=list)
    monthly_return_max: Optional[float] = None
    volume_spike_ratio: Optional[float] = None


class NewsDocument(BaseModel):
    title: str
    date: str
    body: str
    url: Optional[str] = None


class ParsedReport(BaseModel):
    source: str
    parsed_text: str


class NormalizedDataBundle(BaseModel):
    company: CompanyInfo
    disclosures: List[DisclosureItem] = Field(default_factory=list)
    financials: FinancialData = Field(default_factory=FinancialData)
    price_volume: PriceVolumeData = Field(default_factory=PriceVolumeData)
    news_docs: List[NewsDocument] = Field(default_factory=list)
    parsed_reports: List[ParsedReport] = Field(default_factory=list)
    missing_fields: List[str] = Field(default_factory=list)
