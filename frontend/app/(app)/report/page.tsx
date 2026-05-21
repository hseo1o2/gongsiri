import Link from 'next/link'
import Topbar from '@/components/layout/Topbar'
import RiskBadge from '@/components/ui/RiskBadge'
import type { ReportSummaryContract } from '@/lib/api/types'
import type { RiskLevel } from '@/lib/types'

const DEMO_REPORTS: ReportSummaryContract[] = [
  { corpCode: '00258801', corpName: '카카오', riskLevel: 'caution' as RiskLevel, riskScore: 2, analyzedAt: '데모 목록' },
  { corpCode: '00126380', corpName: '삼성전자', riskLevel: 'normal' as RiskLevel, riskScore: 0, analyzedAt: '데모 목록' },
  { corpCode: '00247540', corpName: '에코프로비엠', riskLevel: 'normal' as RiskLevel, riskScore: 1, analyzedAt: '데모 목록' },
]

export default function ReportListPage() {
  return (
    <div>
      <Topbar title="리포트" showSearch={false} />
      <div style={{ padding: 16 }}>
        <div style={{ background: '#E6F1FB', borderLeft: '3px solid #3B8BFF', padding: '10px 14px', marginBottom: 12 }}>
          <p style={{ fontSize: 12, color: '#185FA5', letterSpacing: '-0.02em' }}>
            데모 목록입니다. 항목을 열면 백엔드 /api/v1/reports로 실시간 리포트를 생성합니다.
          </p>
        </div>
        <div style={{ background: 'var(--color-bg-primary)', border: '0.5px solid var(--color-border-tertiary)', borderRadius: 'var(--radius-lg)', overflow: 'hidden' }}>
          {DEMO_REPORTS.map((r, i) => (
            <Link key={r.corpCode} href={`/report/${r.corpCode}`} style={{ textDecoration: 'none', color: 'inherit' }}>
              <div style={{ padding: '14px 16px', borderBottom: i < DEMO_REPORTS.length - 1 ? '0.5px solid var(--color-border-tertiary)' : 'none', display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer' }}>
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
