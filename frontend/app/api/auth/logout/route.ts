import { NextResponse } from 'next/server'
import { DEV_SESSION_COOKIE } from '@/lib/auth/dev-session'

export async function POST() {
  const response = NextResponse.json({ ok: true, message: '공시리 데모 세션을 종료했습니다.' })
  response.cookies.set({ name: DEV_SESSION_COOKIE, value: '', path: '/', maxAge: 0 })
  return response
}
