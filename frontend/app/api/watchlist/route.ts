import { NextRequest, NextResponse } from "next/server";
import {
  DEV_SESSION_COOKIE,
  getBackendBaseUrl,
  isDevSessionCookieValue,
} from "@/lib/auth/dev-session";

function authGuard(req: NextRequest): NextResponse | null {
  if (!isDevSessionCookieValue(req.cookies.get(DEV_SESSION_COOKIE)?.value)) {
    return NextResponse.json(
      {
        ok: false,
        error: {
          code: "login_required",
          message: "공시리 로그인이 필요합니다.",
        },
      },
      { status: 401 },
    );
  }
  return null;
}

export async function GET(req: NextRequest) {
  const guard = authGuard(req);
  if (guard) return guard;

  try {
    const response = await fetch(
      `${getBackendBaseUrl()}/api/v1/dev/watchlist`,
      { cache: "no-store" },
    );
    const data = await response.json();
    if (data?.ok && Array.isArray(data.items)) {
      data.items = data.items.map(remapWatchlistItem);
    }
    return NextResponse.json(data, { status: response.status });
  } catch {
    return NextResponse.json(
      {
        ok: false,
        error: {
          code: "backend_unavailable",
          message: "워치리스트 서버에 연결할 수 없습니다.",
        },
      },
      { status: 502 },
    );
  }
}

export async function POST(req: NextRequest) {
  const guard = authGuard(req);
  if (guard) return guard;

  try {
    const payload = await req.json();
    const backendPayload = {
      corp_code: payload.corp_code,
      corp_name: payload.corp_name ?? payload.name,
      stock_code: payload.stock_code,
      market: payload.market,
    };
    const response = await fetch(
      `${getBackendBaseUrl()}/api/v1/dev/watchlist`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(backendPayload),
        cache: "no-store",
      },
    );
    const data = await response.json();
    if (data?.ok && data.item) {
      data.item = remapWatchlistItem(data.item);
    }
    return NextResponse.json(data, { status: response.status });
  } catch {
    return NextResponse.json(
      {
        ok: false,
        error: {
          code: "backend_unavailable",
          message: "워치리스트 저장 서버에 연결할 수 없습니다.",
        },
      },
      { status: 502 },
    );
  }
}

export async function DELETE(req: NextRequest) {
  const guard = authGuard(req);
  if (guard) return guard;

  const corpCode = req.nextUrl.searchParams.get("corp_code");
  if (!corpCode) {
    return NextResponse.json(
      {
        ok: false,
        error: { code: "invalid_request", message: "corp_code가 필요합니다." },
      },
      { status: 400 },
    );
  }

  try {
    const response = await fetch(
      `${getBackendBaseUrl()}/api/v1/dev/watchlist/${encodeURIComponent(corpCode)}`,
      { method: "DELETE", cache: "no-store" },
    );
    const data = await response.json();
    return NextResponse.json(data, { status: response.status });
  } catch {
    return NextResponse.json(
      {
        ok: false,
        error: {
          code: "backend_unavailable",
          message: "워치리스트 삭제 서버에 연결할 수 없습니다.",
        },
      },
      { status: 502 },
    );
  }
}

function remapWatchlistItem(
  item: Record<string, unknown>,
): Record<string, unknown> {
  return {
    ...item,
    name: item.corp_name ?? item.name,
    added_at: item.last_analyzed ?? item.added_at,
    last_checked: item.last_checked ?? null,
  };
}
