import { NextRequest, NextResponse } from 'next/server'

const DEFAULT_API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:8000'

function trimTrailingSlash(value: string): string {
  return value.endsWith('/') ? value.slice(0, -1) : value
}

export async function POST(req: NextRequest) {
  const { corp_code, corpCode, keyword, question } = await req.json()

  try {
    const res = await fetch(`${trimTrailingSlash(DEFAULT_API_BASE_URL)}/qa`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ corp_code: corp_code ?? corpCode, keyword, question }),
    })
    const data = await res.json()
    return NextResponse.json(data, { status: res.status })
  } catch {
    return NextResponse.json(
      { answer: '', error: 'backend_unavailable', message: 'Q&A 서버에 연결할 수 없습니다.' },
      { status: 502 },
    )
  }
}
