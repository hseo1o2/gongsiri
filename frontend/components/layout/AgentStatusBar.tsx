'use client'
import { useEffect, useState } from 'react'
import { IconRefresh } from '@tabler/icons-react'

export default function AgentStatusBar() {
  const [seconds, setSeconds] = useState(1800)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    const t = setInterval(() => setSeconds(s => s > 0 ? s - 1 : 1800), 1000)
    return () => clearInterval(t)
  }, [])

  const fmt = (s: number) => `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`

  async function handleCheck() {
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/pipeline/trigger', { method: 'POST' })
      const data = await res.json()

      if (!res.ok || data.ok === false) {
        throw new Error(data.error?.message ?? data.message ?? '저 공시리가 파이프라인 실행을 시작하지 못했습니다.')
      }

      setSeconds(1800)
    } catch (err) {
      setError(err instanceof Error ? err.message : '저 공시리가 파이프라인 실행을 시작하지 못했습니다.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{ background: 'var(--color-navy)', padding: '9px 16px', display: 'flex', alignItems: 'center', gap: 10 }}>
      <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#639922', flexShrink: 0, animation: 'pulse 2s infinite' }} />
      <style>{`@keyframes pulse{0%,100%{opacity:1}50%{opacity:0.4}}`}</style>
      <span style={{ fontSize: 11, color: '#B5D4F4', letterSpacing: '-0.01em', flex: 1 }}>
        공시리 모니터링 중
      </span>
      <span className="font-mono" style={{ fontSize: 10, color: '#5F5E5A' }}>다음 폴링 {fmt(seconds)}</span>
      {error && <span style={{ fontSize: 10, color: '#FFD4D4' }}>{error}</span>}
      <button
        onClick={handleCheck}
        disabled={loading}
        style={{ marginLeft: 10, background: '#1A2235', border: '0.5px solid #2A3A52', color: '#B5D4F4', fontSize: 11, fontFamily: 'Noto Sans KR, sans-serif', letterSpacing: '-0.02em', padding: '4px 10px', borderRadius: 6, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}
      >
        <IconRefresh size={12} />
        {loading ? '체크 중...' : '지금 체크'}
      </button>
    </div>
  )
}
