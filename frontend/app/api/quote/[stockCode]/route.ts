import { NextRequest, NextResponse } from "next/server";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ stockCode: string }> },
) {
  const { stockCode } = await params;
  const market = req.nextUrl.searchParams.get("market") ?? "KOSPI";
  const apiBase =
    process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000";

  try {
    const res = await fetch(
      `${apiBase}/api/quote/${stockCode}?market=${market}`,
      { cache: "no-store" },
    );
    const data = await res.json();
    return NextResponse.json(data, { status: res.status });
  } catch {
    return NextResponse.json(
      {
        stock_code: stockCode,
        price: null,
        change_rate: null,
        error: "backend_unavailable",
      },
      { status: 502 },
    );
  }
}
