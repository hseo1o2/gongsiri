'use client'

import Link from 'next/link'
import Topbar from '@/components/layout/Topbar'
import RiskBadge from '@/components/ui/RiskBadge'
import { useDemoSession } from '@/lib/demo-session'

export default function ReportListPage() {
  const { reportSummaries } = useDemoSession()

  return (
    <div>
      <Topbar title="리포트" showSearch={false} />
      <div style={{ padding: 16 }}>
        <div style={{ background: '#E6F1FB', borderLeft: '3px solid #3B8BFF', padding: '10px 14px', marginBottom: 12 }}>
          <p style={{ fontSize: 12, color: '#185FA5', letterSpacing: '-0.02em' }}>
            데모 세션 리포트 목록입니다. 항목을 열면 백엔드 /api/v1/reports를 통해 Pi-first 상세 리포트를 요청합니다.
          </p>
        </div>
        <div style={{ background: 'var(--color-bg-primary)', border: '0.5px solid var(--color-border-tertiary)', borderRadius: 'var(--radius-lg)', overflow: 'hidden' }}>
          {reportSummaries.length === 0 ? (
            <div style={{ padding: '28px 16px', textAlign: 'center', color: 'var(--color-text-tertiary)', fontSize: 13, letterSpacing: '-0.02em' }}>
              표시할 리포트가 없습니다. 워치리스트에 종목을 추가하세요.
            </div>
          ) : reportSummaries.map((r, i) => (
            <Link key={r.corpCode} href={`/report/${r.corpCode}`} style={{ textDecoration: 'none', color: 'inherit' }}>
              <div style={{ padding: '14px 16px', borderBottom: i < reportSummaries.length - 1 ? '0.5px solid var(--color-border-tertiary)' : 'none', display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer' }}>
                <div style={{ flex: 1 }}>
                  <p style={{ fontSize: 14, fontWeight: 500, letterSpacing: '-0.03em' }}>{r.corpName}</p>
                  <p className="font-mono" style={{ fontSize: 10, color: 'var(--color-text-tertiary)', marginTop: 2 }}>{r.analyzedAt} 분석</p>
                </div>
                <RiskBadge level={r.riskLevel} size="sm" />
                <p className="font-mono" style={{ fontSize: 12, color: 'var(--color-text-tertiary)', minWidth: 32, textAlign: 'right' }}>{r.riskScore}/6</p>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  )
}
