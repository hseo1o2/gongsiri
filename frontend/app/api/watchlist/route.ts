import { NextRequest, NextResponse } from "next/server";

const DEFAULT_API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000";

function trimTrailingSlash(value: string): string {
  return value.endsWith("/") ? value.slice(0, -1) : value;
}

function backendUrl(path: string): string {
  return `${trimTrailingSlash(DEFAULT_API_BASE_URL)}${path}`;
}

export async function GET() {
  try {
    const response = await fetch(backendUrl("/api/watchlist"), {
      cache: "no-store",
    });
    const data = await response.json();
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
  try {
    const payload = await req.json();
    const response = await fetch(backendUrl("/api/watchlist"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      cache: "no-store",
    });
    const data = await response.json();
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
      backendUrl(`/api/watchlist?corp_code=${encodeURIComponent(corpCode)}`),
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
