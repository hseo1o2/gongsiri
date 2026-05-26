import { NextRequest, NextResponse } from "next/server";

const BACKEND_BASE =
  process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000";

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ corpCode: string }> },
) {
  const { corpCode } = await params;

  try {
    const response = await fetch(
      `${BACKEND_BASE}/api/reports/${corpCode}/refresh`,
      {
        method: "POST",
        cache: "no-store",
      },
    );
    const data = await response.json();
    return NextResponse.json(data, { status: response.status });
  } catch {
    return NextResponse.json(
      {
        ok: false,
        error: {
          code: "backend_unavailable",
          message: "저 공시리가 재분석 서버에 연결하지 못했습니다.",
        },
      },
      { status: 502 },
    );
  }
}
