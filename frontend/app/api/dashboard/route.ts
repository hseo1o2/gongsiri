import { NextRequest, NextResponse } from 'next/server'
import { DEV_SESSION_COOKIE, getBackendBaseUrl, isDevSessionCookieValue } from '@/lib/auth/dev-session'

export async function GET(req: NextRequest) {
  if (!isDevSessionCookieValue(req.cookies.get(DEV_SESSION_COOKIE)?.value)) {
    return NextResponse.json(
      { ok: false, error: { code: 'login_required', message: '공시리 로그인이 필요합니다.' } },
      { status: 401 },
    )
  }

  try {
    const response = await fetch(`${getBackendBaseUrl()}/api/v1/dev/dashboard`, { cache: 'no-store' })
    const data = await response.json()
    return NextResponse.json(data, { status: response.status })
  } catch {
    return NextResponse.json(
      { ok: false, error: { code: 'backend_unavailable', message: '대시보드 서버에 연결할 수 없습니다.' } },
      { status: 502 },
    )
  }
}
