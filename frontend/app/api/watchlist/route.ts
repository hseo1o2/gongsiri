import { NextRequest, NextResponse } from 'next/server'
import { DEV_SESSION_COOKIE, getBackendBaseUrl, isDevSessionCookieValue } from '@/lib/auth/dev-session'

function requireSession(req: NextRequest): NextResponse | null {
  if (isDevSessionCookieValue(req.cookies.get(DEV_SESSION_COOKIE)?.value)) {
    return null
  }
  return NextResponse.json(
    { ok: false, error: { code: 'login_required', message: '공시리 로그인이 필요합니다.' } },
    { status: 401 },
  )
}

export async function GET(req: NextRequest) {
  const failure = requireSession(req)
  if (failure) return failure

  try {
    const response = await fetch(`${getBackendBaseUrl()}/api/v1/dev/watchlist`, { cache: 'no-store' })
    const data = await response.json()
    return NextResponse.json(data, { status: response.status })
  } catch {
    return NextResponse.json(
      { ok: false, error: { code: 'backend_unavailable', message: '워치리스트 서버에 연결할 수 없습니다.' } },
      { status: 502 },
    )
  }
}

export async function POST(req: NextRequest) {
  const failure = requireSession(req)
  if (failure) return failure

  try {
    const payload = await req.json()
    const response = await fetch(`${getBackendBaseUrl()}/api/v1/dev/watchlist`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      cache: 'no-store',
    })
    const data = await response.json()
    return NextResponse.json(data, { status: response.status })
  } catch {
    return NextResponse.json(
      { ok: false, error: { code: 'backend_unavailable', message: '워치리스트 저장 서버에 연결할 수 없습니다.' } },
      { status: 502 },
    )
  }
}

export async function DELETE(req: NextRequest) {
  const failure = requireSession(req)
  if (failure) return failure

  const corpCode = req.nextUrl.searchParams.get('corp_code')
  if (!corpCode) {
    return NextResponse.json(
      { ok: false, error: { code: 'invalid_request', message: 'corp_code가 필요합니다.' } },
      { status: 400 },
    )
  }

  try {
    const response = await fetch(
      `${getBackendBaseUrl()}/api/v1/dev/watchlist/${encodeURIComponent(corpCode)}`,
      { method: 'DELETE', cache: 'no-store' },
    )
    const data = await response.json()
    return NextResponse.json(data, { status: response.status })
  } catch {
    return NextResponse.json(
      { ok: false, error: { code: 'backend_unavailable', message: '워치리스트 삭제 서버에 연결할 수 없습니다.' } },
      { status: 502 },
    )
  }
}
