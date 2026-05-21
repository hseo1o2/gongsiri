from __future__ import annotations

from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, Field

PipelineTriggerSource = Literal["user", "system", "cron"]


class PipelineTriggerRequest(BaseModel):
    model_config = ConfigDict(populate_by_name=True, extra="allow")

    source: PipelineTriggerSource | None = None
    keyword: str | None = None
    corp_code: str | None = Field(default=None, alias="corpCode")
    trace_id: str | None = Field(default=None, alias="traceId")
    contract_version: str | None = Field(default=None, alias="contractVersion")
    metadata: dict[str, Any] = Field(default_factory=dict)

    def to_pipeline_request(self) -> dict[str, Any]:
        request: dict[str, Any] = {
            "source": self.source or "user",
            "metadata": self.metadata,
        }
        if self.keyword:
            request["keyword"] = self.keyword
        if self.corp_code:
            request["corpCode"] = self.corp_code
        if self.contract_version:
            request["contractVersion"] = self.contract_version
        return request
