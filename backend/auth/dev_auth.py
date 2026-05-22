from __future__ import annotations

import os
from dataclasses import dataclass
from typing import Any

from backend.storage.repositories import DevRepositoryProvider, Row

AUTH_MODE_ENV = "GONGSIRI_AUTH_MODE"
DEV_AUTH_MODE = "dev"
DEV_SESSION_PREFIX = "dev-session:"
DEV_SESSION_TTL_SECONDS = 8 * 60 * 60


@dataclass(frozen=True)
class DevAuthResult:
    user: Row
    token: str


def is_dev_auth_enabled() -> bool:
    return os.getenv(AUTH_MODE_ENV, "").strip().lower() == DEV_AUTH_MODE


def build_dev_session_token(user_id: str) -> str:
    return f"{DEV_SESSION_PREFIX}{user_id}"


def login_dev_user(
    provider: DevRepositoryProvider,
    *,
    username: str,
    password: str,
) -> DevAuthResult | None:
    user = provider.users.get_by_username(username)
    if user is None or user.get("password_secret") != password:
        return None
    return DevAuthResult(user=user, token=build_dev_session_token(str(user["id"])))


def public_user_session(user: Row) -> dict[str, Any]:
    return {
        "userId": user["id"],
        "username": user["username"],
        "role": user["role"],
        "displayName": "공시리 데모 관리자" if user["role"] == "admin" else str(user["username"]),
        "expiresInSeconds": DEV_SESSION_TTL_SECONDS,
    }
