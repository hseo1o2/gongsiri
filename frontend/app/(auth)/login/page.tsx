'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { FormEvent, useState } from 'react'

function resolveLoginMessage(payload: unknown): string {
  if (typeof payload === 'object' && payload !== null) {
    const record = payload as { error?: { message?: string }; message?: string }
    return record.error?.message ?? record.message ?? '저 공시리가 로그인 상태를 확인하지 못했습니다.'
  }
  return '저 공시리가 로그인 상태를 확인하지 못했습니다.'
}

export default function LoginPage() {
  const router = useRouter()
  const [username, setUsername] = useState('admin')
  const [password, setPassword] = useState('admin')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError('')
    setLoading(true)

    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      })
      const data = await response.json()
      if (!response.ok || data?.ok !== true) {
        throw new Error(resolveLoginMessage(data))
      }
      router.replace('/dashboard')
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : '저 공시리가 로그인 상태를 확인하지 못했습니다.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <main style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', background: 'var(--color-bg-secondary)', padding: 24 }}>
      <section style={{ width: '100%', maxWidth: 420, background: 'var(--color-bg-primary)', border: '0.5px solid var(--color-border-tertiary)', borderRadius: 'var(--radius-lg)', padding: 28, boxShadow: '0 18px 40px rgba(10,15,28,0.08)' }}>
        <div style={{ marginBottom: 22 }}>
          <p className="font-display" style={{ fontSize: 38, color: 'var(--color-navy)', lineHeight: 1 }}>공시리<span style={{ color: 'var(--color-blue)' }}>.</span></p>
          <h1 style={{ fontSize: 20, letterSpacing: '-0.04em', marginTop: 10 }}>데모 관리자 로그인</h1>
          <p style={{ fontSize: 13, color: 'var(--color-text-secondary)', lineHeight: 1.6, marginTop: 8 }}>
            개발 모드에서는 로컬 DB에 seed된 <span className="font-mono">admin/admin</span> 계정으로 앱 shell을 확인합니다.
          </p>
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <label style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 12, color: 'var(--color-text-secondary)' }}>
            아이디
            <input value={username} onChange={event => setUsername(event.target.value)} autoComplete="username" style={{ height: 40, border: '0.5px solid var(--color-border-secondary)', borderRadius: 'var(--radius-md)', padding: '0 12px', fontSize: 14 }} />
          </label>
          <label style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 12, color: 'var(--color-text-secondary)' }}>
            비밀번호
            <input value={password} onChange={event => setPassword(event.target.value)} type="password" autoComplete="current-password" style={{ height: 40, border: '0.5px solid var(--color-border-secondary)', borderRadius: 'var(--radius-md)', padding: '0 12px', fontSize: 14 }} />
          </label>

          {error && (
            <div style={{ background: '#FCEBEB', borderLeft: '3px solid var(--color-red)', borderRadius: 'var(--radius-md)', padding: '10px 12px', color: '#A32D2D', fontSize: 12, lineHeight: 1.5 }}>
              {error}
            </div>
          )}

          <button type="submit" disabled={loading} style={{ height: 42, border: 0, borderRadius: 'var(--radius-md)', background: loading ? '#8AB8FF' : 'var(--color-blue)', color: '#fff', fontWeight: 700, cursor: loading ? 'wait' : 'pointer', marginTop: 4 }}>
            {loading ? '공시리가 확인 중...' : '로그인'}
          </button>
        </form>

        <p style={{ fontSize: 12, color: 'var(--color-text-tertiary)', marginTop: 18, lineHeight: 1.6 }}>
          실제 회원가입/JWT/Supabase Auth는 아직 연결하지 않습니다. <Link href="/signup" style={{ color: 'var(--color-blue)', textDecoration: 'none' }}>회원가입 화면 보기</Link>
        </p>
      </section>
    </main>
  )
}
