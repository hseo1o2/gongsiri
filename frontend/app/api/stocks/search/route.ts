import { NextRequest, NextResponse } from "next/server";

const DEFAULT_API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000";

function trimTrailingSlash(value: string): string {
  return value.endsWith("/") ? value.slice(0, -1) : value;
}

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get("q") ?? "";

  try {
    const res = await fetch(
      `${trimTrailingSlash(DEFAULT_API_BASE_URL)}/api/stocks/search?q=${encodeURIComponent(q)}`,
      { cache: "no-store" },
    );
    const data = await res.json();

    // Normalize backend response: existing route returns `results`, new route returns `items`
    const rawItems = data.items ?? data.results ?? [];
    const items = Array.isArray(rawItems) ? rawItems : [];

    return NextResponse.json({ items }, { status: res.ok ? 200 : res.status });
  } catch {
    return NextResponse.json(
      {
        ok: false,
        source_id: "krx_stock_search",
        availability: "unavailable",
        error: {
          code: "backend_unavailable",
          message: "저 공시리가 종목 검색 서버에 연결하지 못했습니다.",
        },
        items: [],
      },
      { status: 502 },
    );
  }
}
