'use client'

import { useState } from 'react'
import { IconSend } from '@tabler/icons-react'
import ReactMarkdown from 'react-markdown'
import Topbar from '@/components/layout/Topbar'
import Button from '@/components/ui/Button'
import RiskBadge from '@/components/ui/RiskBadge'
import { useDemoSession } from '@/lib/demo-session'

interface Message {
  role: 'user' | 'assistant'
  content: string
}

function resolveQaFailure(data: unknown): string {
  if (typeof data === 'object' && data !== null) {
    const record = data as { error?: { message?: string }; message?: string; detail?: string }
    return record.error?.message ?? record.message ?? record.detail ?? '답변을 가져올 수 없습니다.'
  }
  return '답변을 가져올 수 없습니다.'
}

export default function QAPage() {
  const { qaStockOptions } = useDemoSession()
  const [selectedCorp, setSelectedCorp] = useState(() => qaStockOptions[0]?.corp_code ?? '')
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)

  const activeCorpCode = qaStockOptions.some(s => s.corp_code === selectedCorp)
    ? selectedCorp
    : qaStockOptions[0]?.corp_code ?? ''
  const corp = qaStockOptions.find(s => s.corp_code === activeCorpCode)

  async function handleSend() {
    if (!corp || !input.trim() || loading) return
    const question = input.trim()
    setInput('')
    setMessages(prev => [...prev, { role: 'user', content: question }])
    setLoading(true)
    try {
      const res = await fetch('/api/qa', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ corp_code: corp.corp_code, question }),
      })
      const data = await res.json()

      if (!res.ok || typeof data.answer !== 'string' || !data.answer.trim()) {
        throw new Error(resolveQaFailure(data))
      }

      setMessages(prev => [...prev, { role: 'assistant', content: data.answer }])
    } catch (err) {
      const message = err instanceof Error ? err.message : '답변을 가져올 수 없습니다.'
      setMessages(prev => [...prev, { role: 'assistant', content: message }])
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 52px - 36px)' }}>
      <Topbar title="Q&A" showSearch={false} />

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', padding: 16, gap: 12, overflow: 'hidden' }}>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <span style={{ fontSize: 12, color: 'var(--color-text-tertiary)' }}>분석 종목</span>
          <select
            value={activeCorpCode}
            onChange={e => { setSelectedCorp(e.target.value); setMessages([]) }}
            style={{ fontSize: 13, fontFamily: 'Noto Sans KR, sans-serif', letterSpacing: '-0.03em', border: '0.5px solid var(--color-border-secondary)', borderRadius: 'var(--radius-md)', padding: '5px 10px', background: 'var(--color-bg-primary)', outline: 'none' }}
          >
            {qaStockOptions.map(s => <option key={s.corp_code} value={s.corp_code}>{s.corp_name}</option>)}
          </select>
          {corp && <RiskBadge level={corp.risk_level} size="sm" />}
        </div>

        <div style={{ flex: 1, background: 'var(--color-bg-primary)', border: '0.5px solid var(--color-border-tertiary)', borderRadius: 'var(--radius-lg)', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
          <div style={{ flex: 1, overflowY: 'auto', padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
            {messages.length === 0 && (
              <div style={{ textAlign: 'center', marginTop: 40 }}>
                <p style={{ fontSize: 14, color: 'var(--color-text-tertiary)', letterSpacing: '-0.02em' }}>
                  {corp ? `${corp.corp_name} 관련 공시·분석 내용에 대해 질문하세요.` : '워치리스트 종목을 추가하면 Q&A를 사용할 수 있습니다.'}
                </p>
                {corp && (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, justifyContent: 'center', marginTop: 16 }}>
                    {['CB 발행의 영향은?', '최근 공시 요약해줘', '위험 수준이 높아진 이유는?'].map(q => (
                      <button key={q} onClick={() => setInput(q)} style={{ fontSize: 12, color: '#3B8BFF', border: '0.5px solid #3B8BFF', borderRadius: 100, padding: '5px 12px', background: '#EBF2FF', cursor: 'pointer', letterSpacing: '-0.02em' }}>
                        {q}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
            {messages.map((m, i) => (
              <div key={i} style={{ display: 'flex', justifyContent: m.role === 'user' ? 'flex-end' : 'flex-start' }}>
                <div style={{
                  maxWidth: '75%', padding: '10px 14px', borderRadius: 10, fontSize: 13, lineHeight: 1.65, letterSpacing: '-0.02em',
                  background: m.role === 'user' ? 'var(--color-navy)' : 'var(--color-bg-secondary)',
                  color: m.role === 'user' ? '#E8F4FF' : 'var(--color-text-primary)',
                }}>
                  {m.role === 'assistant' ? <ReactMarkdown>{m.content}</ReactMarkdown> : m.content}
                </div>
              </div>
            ))}
            {loading && (
              <div style={{ display: 'flex', justifyContent: 'flex-start' }}>
                <div style={{ padding: '10px 14px', borderRadius: 10, background: 'var(--color-bg-secondary)', fontSize: 13, color: 'var(--color-text-tertiary)' }}>
                  공시리 Pi agent가 분석 중...
                </div>
              </div>
            )}
          </div>

          <div style={{ borderTop: '0.5px solid var(--color-border-tertiary)', padding: '12px 16px', display: 'flex', gap: 8 }}>
            <input
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && !e.shiftKey && handleSend()}
              placeholder={corp ? `${corp.corp_name}에 대해 질문하세요` : '종목을 선택하세요'}
              style={{ flex: 1, height: 36, padding: '0 12px', fontSize: 13, fontFamily: 'Noto Sans KR, sans-serif', letterSpacing: '-0.03em', border: '0.5px solid var(--color-border-secondary)', borderRadius: 'var(--radius-md)', outline: 'none', background: 'var(--color-bg-primary)' }}
            />
            <Button onClick={handleSend} disabled={!corp || !input.trim() || loading} size="sm">
              <IconSend size={13} />
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
