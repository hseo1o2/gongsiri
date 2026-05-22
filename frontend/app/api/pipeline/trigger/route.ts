import { NextResponse } from 'next/server'
import { getBackendBaseUrl } from '@/lib/auth/dev-session'

export async function POST() {
  try {
    const result = await fetch(`${getBackendBaseUrl()}/pipeline/trigger`, { method: 'POST' })
    const data = await result.json()
    return NextResponse.json(data, { status: result.status })
  } catch {
    return NextResponse.json(
      {
        ok: false,
        error: { code: 'backend_unavailable', message: '저 공시리가 파이프라인 서버에 연결하지 못했습니다.' },
      },
      { status: 502 },
    )
  }
}
