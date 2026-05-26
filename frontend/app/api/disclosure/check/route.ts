import { NextRequest, NextResponse } from 'next/server';

const BACKEND_BASE =
  process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:8000';

export async function POST(req: NextRequest) {
  try {
    const payload = await req.json();
    const response = await fetch(`${BACKEND_BASE}/api/disclosure/check`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      cache: 'no-store',
    });
    const data = await response.json();
    return NextResponse.json(data, { status: response.status });
  } catch {
    return NextResponse.json(
      {
        ok: false,
        error: {
          code: 'backend_unavailable',
          message: '저 공시리가 공시 체크 서버에 연결하지 못했습니다.',
        },
      },
      { status: 502 },
    );
  }
}
