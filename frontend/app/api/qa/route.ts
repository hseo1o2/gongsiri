import { NextRequest, NextResponse } from 'next/server'
import { DEV_SESSION_COOKIE, isDevSessionCookieValue } from '@/lib/auth/dev-session'

const DEFAULT_API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:8000'

function trimTrailingSlash(value: string): string {
  return value.endsWith('/') ? value.slice(0, -1) : value
}

export async function POST(req: NextRequest) {
  if (!isDevSessionCookieValue(req.cookies.get(DEV_SESSION_COOKIE)?.value)) {
    return NextResponse.json(
      { ok: false, error: { code: 'login_required', message: '공시리 로그인이 필요합니다.' } },
      { status: 401 },
    )
  }

  let payload: { corp_code?: string; corpCode?: string; keyword?: string; question?: string }
  try {
    payload = await req.json()
  } catch {
    return NextResponse.json(
      { ok: false, error: { code: 'invalid_request', message: '저 공시리가 요청 형식을 이해하지 못했습니다.' } },
      { status: 400 },
    )
  }

  try {
    const res = await fetch(`${trimTrailingSlash(DEFAULT_API_BASE_URL)}/qa`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        corp_code: payload.corp_code ?? payload.corpCode,
        keyword: payload.keyword,
        question: payload.question,
      }),
    })
    const data = await res.json()
    return NextResponse.json(data, { status: res.status })
  } catch {
    return NextResponse.json(
      {
        ok: false,
        error: { code: 'backend_unavailable', message: '저 공시리가 Q&A 서버에 연결하지 못했습니다.' },
      },
      { status: 502 },
    )
  }
}
