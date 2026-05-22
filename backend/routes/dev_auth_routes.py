from __future__ import annotations

from fastapi import APIRouter, Request
from fastapi.responses import JSONResponse

from backend.auth.dev_auth import (
    DEV_SESSION_TTL_SECONDS,
    is_dev_auth_enabled,
    login_dev_user,
    public_user_session,
)
from backend.http_contracts import read_json_object, utc_now
from backend.storage.connection import get_repository_provider

router = APIRouter(prefix="/api/v1/dev/auth", tags=["dev-auth"])


def auth_failure(code: str, message: str) -> dict[str, object]:
    return {
        "ok": False,
        "authMode": "dev",
        "observedAt": utc_now(),
        "error": {"code": code, "message": message},
    }


@router.post("/login")
async def login(request: Request) -> JSONResponse:
    if not is_dev_auth_enabled():
        return JSONResponse(
            content=auth_failure(
                "dev_auth_disabled",
                "저 공시리는 dev 인증 모드에서만 데모 로그인을 허용합니다.",
            ),
            status_code=403,
        )

    try:
        payload, _empty_body = await read_json_object(request)
    except ValueError as exc:
        return JSONResponse(content=auth_failure("invalid_request", str(exc)), status_code=400)

    username = str(payload.get("username") or "").strip()
    password = str(payload.get("password") or "")
    if not username or not password:
        return JSONResponse(
            content=auth_failure("invalid_credentials", "아이디와 비밀번호를 모두 입력해 주세요."),
            status_code=400,
        )

    result = login_dev_user(get_repository_provider(), username=username, password=password)
    if result is None:
        return JSONResponse(
            content=auth_failure(
                "invalid_credentials",
                "저 공시리가 로그인 정보를 확인하지 못했습니다.",
            ),
            status_code=401,
        )

    return JSONResponse(
        content={
            "ok": True,
            "authMode": "dev",
            "session": public_user_session(result.user),
            "token": result.token,
            "expiresInSeconds": DEV_SESSION_TTL_SECONDS,
            "evidence": [
                {
                    "source": "dev_db_users",
                    "userId": result.user["id"],
                    "sourceVersion": result.user["source_version"],
                }
            ],
        },
        status_code=200,
    )
