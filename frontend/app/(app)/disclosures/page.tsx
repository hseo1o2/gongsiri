'use client'

import Topbar from '@/components/layout/Topbar'
import RiskBadge from '@/components/ui/RiskBadge'
import { useDemoSession } from '@/lib/demo-session'

export default function DisclosuresPage() {
  const { state } = useDemoSession()

  return (
    <div>
      <Topbar title="공시 알림" showSearch={false} />
      <div style={{ padding: 16 }}>
        <div style={{ background: 'var(--color-bg-primary)', border: '0.5px solid var(--color-border-tertiary)', borderRadius: 'var(--radius-lg)', overflow: 'hidden' }}>
          {state.loadStatus.state === 'loading' && (
            <div style={{ padding: '24px 16px', textAlign: 'center', color: 'var(--color-text-tertiary)', fontSize: 13 }}>
              dev DB 기반 공시 알림을 불러오는 중입니다.
            </div>
          )}
          {state.loadStatus.state === 'error' && (
            <div style={{ padding: '24px 16px', textAlign: 'center', color: '#A32D2D', fontSize: 13 }}>
              {state.loadStatus.message}
            </div>
          )}
          {state.loadStatus.state === 'ready' && state.recentDisclosures.length === 0 && (
            <div style={{ padding: '24px 16px', textAlign: 'center', color: 'var(--color-text-tertiary)', fontSize: 13 }}>
              최근 공시 알림이 없습니다.
            </div>
          )}
          {state.loadStatus.state === 'ready' &&
            state.recentDisclosures.map((a, i) => (
              <div key={a.id} style={{ padding: '14px 16px', borderBottom: i < state.recentDisclosures.length - 1 ? '0.5px solid var(--color-border-tertiary)' : 'none' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <RiskBadge level={a.risk_level === 'info' ? 'normal' : a.risk_level} size="sm" />
                    <span style={{ fontSize: 13, fontWeight: 500, letterSpacing: '-0.03em' }}>{a.corp_name}</span>
                  </div>
                  <span className="font-mono" style={{ fontSize: 10, color: 'var(--color-text-tertiary)' }}>{a.time}</span>
                </div>
                <p style={{ fontSize: 13, fontWeight: 500, letterSpacing: '-0.03em', marginBottom: 3 }}>{a.title}</p>
                <p style={{ fontSize: 12, color: 'var(--color-text-secondary)', letterSpacing: '-0.02em', lineHeight: 1.5 }}>{a.description}</p>
              </div>
            ))}
        </div>
      </div>
    </div>
  )
}
