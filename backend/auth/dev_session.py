from __future__ import annotations

from typing import Any

from fastapi.responses import JSONResponse

from backend.auth.dev_auth import is_dev_auth_enabled
from backend.http_contracts import utc_now
from backend.storage.seed import DEV_ADMIN_ID


def dev_auth_failure(code: str, message: str) -> dict[str, object]:
    return {"ok": False, "observedAt": utc_now(), "error": {"code": code, "message": message}}


def require_dev_auth_mode() -> JSONResponse | None:
    if is_dev_auth_enabled():
        return None
    return JSONResponse(
        content=dev_auth_failure(
            "dev_auth_disabled",
            "저 공시리는 dev 인증 모드에서만 데모 데이터를 제공합니다.",
        ),
        status_code=403,
    )


def resolve_dev_user_id() -> str:
    return DEV_ADMIN_ID


def build_dev_user_scoped_row(values: dict[str, Any]) -> dict[str, Any]:
    return {**values, "user_id": resolve_dev_user_id()}
