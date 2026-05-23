import { NextRequest, NextResponse } from 'next/server'
import {
  DEV_SESSION_COOKIE,
  DEV_SESSION_COOKIE_OPTIONS,
  DEV_SESSION_MAX_AGE_SECONDS,
  getBackendBaseUrl,
} from '@/lib/auth/dev-session'

export async function POST(req: NextRequest) {
  let payload: unknown

  try {
    payload = await req.json()
  } catch {
    return NextResponse.json(
      { ok: false, error: { code: 'invalid_request', message: '로그인 요청 형식을 확인해 주세요.' } },
      { status: 400 },
    )
  }

  try {
    const res = await fetch(`${getBackendBaseUrl()}/api/v1/dev/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      cache: 'no-store',
    })
    const data = await res.json()
    const responseBody = { ...data }
    if ('token' in responseBody) {
      delete responseBody.token
    }
    const response = NextResponse.json(responseBody, { status: res.status })

    if (res.ok && data?.ok === true && typeof data.token === 'string') {
      response.cookies.set({
        name: DEV_SESSION_COOKIE,
        value: data.token,
        ...DEV_SESSION_COOKIE_OPTIONS,
        maxAge: DEV_SESSION_MAX_AGE_SECONDS,
      })
    }

    return response
  } catch {
    return NextResponse.json(
      { ok: false, error: { code: 'backend_unavailable', message: '공시리 로그인 서버에 연결할 수 없습니다.' } },
      { status: 502 },
    )
  }
}
