import { NextRequest, NextResponse } from 'next/server'
import { DEV_SESSION_COOKIE, isDevSessionCookieValue } from '@/lib/auth/dev-session'
import { getBackendReportsEndpoint } from '@/lib/api/reports'

function requireSession(req: NextRequest): NextResponse | null {
  if (isDevSessionCookieValue(req.cookies.get(DEV_SESSION_COOKIE)?.value)) {
    return null
  }
  return NextResponse.json(
    { ok: false, error: { code: 'login_required', message: '공시리 로그인이 필요합니다.' } },
    { status: 401 },
  )
}

export async function POST(req: NextRequest) {
  const failure = requireSession(req)
  if (failure) return failure

  let payload: unknown

  try {
    payload = await req.json()
  } catch {
    return NextResponse.json(
      { ok: false, error: { code: 'invalid_request', message: '저 공시리가 요청 형식을 이해하지 못했습니다.' } },
      { status: 400 },
    )
  }

  try {
    const res = await fetch(getBackendReportsEndpoint(), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      cache: 'no-store',
    })
    const data = await res.json()
    return NextResponse.json(data, { status: res.status })
  } catch {
    return NextResponse.json(
      {
        ok: false,
        error: { code: 'backend_unavailable', message: '저 공시리가 리포트 서버에 연결하지 못했습니다.' },
      },
      { status: 502 },
    )
  }
}
