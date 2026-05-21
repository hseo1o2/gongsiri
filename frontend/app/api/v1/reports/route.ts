import { NextRequest, NextResponse } from 'next/server'
import { getBackendReportsEndpoint } from '@/lib/api/reports'

export async function POST(req: NextRequest) {
  let payload: unknown

  try {
    payload = await req.json()
  } catch {
    return NextResponse.json(
      { error: { code: 'invalid_request', message: 'Request body must be valid JSON.' } },
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
      { error: { code: 'backend_unavailable', message: '리포트 서버에 연결할 수 없습니다.' } },
      { status: 502 },
    )
  }
}
