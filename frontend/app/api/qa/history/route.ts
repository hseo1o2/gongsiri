import { NextRequest, NextResponse } from 'next/server'
import { DEV_SESSION_COOKIE, isDevSessionCookieValue } from '@/lib/auth/dev-session'

const DEFAULT_API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:8000'

function trimTrailingSlash(value: string): string {
  return value.endsWith('/') ? value.slice(0, -1) : value
}

export async function GET(req: NextRequest) {
  if (!isDevSessionCookieValue(req.cookies.get(DEV_SESSION_COOKIE)?.value)) {
    return NextResponse.json(
      { ok: false, error: { code: 'login_required', message: '공시리 로그인이 필요합니다.' } },
      { status: 401 },
    )
  }

  const corpCode = req.nextUrl.searchParams.get('corp_code')
  const target = corpCode
    ? `${trimTrailingSlash(DEFAULT_API_BASE_URL)}/api/v1/qa-history?corp_code=${encodeURIComponent(corpCode)}`
    : `${trimTrailingSlash(DEFAULT_API_BASE_URL)}/api/v1/qa-history`

  try {
    const res = await fetch(target, { cache: 'no-store' })
    const data = await res.json()
    return NextResponse.json(data, { status: res.status })
  } catch {
    return NextResponse.json(
      {
        ok: false,
        error: { code: 'backend_unavailable', message: '저 공시리가 Q&A 이력 서버에 연결하지 못했습니다.' },
      },
      { status: 502 },
    )
  }
}
