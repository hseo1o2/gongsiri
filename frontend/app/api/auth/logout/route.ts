import { NextResponse } from 'next/server'
import { DEV_SESSION_COOKIE, DEV_SESSION_COOKIE_OPTIONS } from '@/lib/auth/dev-session'

export async function POST() {
  const response = NextResponse.json({ ok: true, message: '공시리 데모 세션을 종료했습니다.' })
  // 발급 때와 동일한 속성으로 덮어써야 브라우저가 쿠키를 확실히 만료시킨다.
  response.cookies.set({ name: DEV_SESSION_COOKIE, value: '', ...DEV_SESSION_COOKIE_OPTIONS, maxAge: 0 })
  return response
}
