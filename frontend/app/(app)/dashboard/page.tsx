'use client'

'use client'

import Topbar from '@/components/layout/Topbar'
import MetricCard from '@/components/ui/MetricCard'
import RiskBadge from '@/components/ui/RiskBadge'
import RiskProgressBar from '@/components/ui/RiskProgressBar'
import { useDemoSession } from '@/lib/demo-session'
import type { DisclosureAlert, WatchlistItem } from '@/lib/types'

const ALERT_BADGE: Record<string, { label: string; bg: string; color: string }> = {
  high: { label: '위험', bg: '#FCEBEB', color: '#A32D2D' },
  caution: { label: '주의', bg: '#FAEEDA', color: '#854F0B' },
  info: { label: '공시', bg: '#E6F1FB', color: '#185FA5' },
}

function normalizeAlerts(items: DisclosureAlert[]): DisclosureAlert[] {
  return items.map(item => ({
    ...item,
    risk_level: item.risk_level === 'normal' ? 'info' : item.risk_level,
  }))
}

function formatSignedRate(changeRate: WatchlistItem['change_rate']) {
  if (typeof changeRate !== 'number') return '—'
  return `${changeRate >= 0 ? '▲' : '▼'} ${Math.abs(changeRate)}%`
}

export default function DashboardPage() {
  const { dashboardSummary: summary, state, watchlist } = useDemoSession()
  const alerts = normalizeAlerts(state.recentDisclosures)
  const dangerColor = summary.dangerCount > 0 ? '#E24B4A' : '#639922'
  const cautionColor = summary.cautionCount > 0 ? '#BA7517' : 'var(--color-text-primary)'
  const normalCount = Math.max(summary.count - summary.cautionCount - summary.dangerCount, 0)
  const averageRisk =
    summary.count === 0
      ? 0
      : watchlist.reduce((sum, item) => sum + (item.risk_score ?? 0), 0) / summary.count

  return (
    <div>
      <Topbar title="대시보드" ctaLabel="종목 추가" />
      <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 10 }}>
          <MetricCard value={summary.count} label="모니터링 종목" />
          <MetricCard value={summary.todayDisclosures} label="오늘 신규 공시" valueColor="#E24B4A" sub="수동 점검 기준" />
          <MetricCard value={summary.cautionCount} label="주의 종목" valueColor={cautionColor} sub={summary.cautionCount > 0 ? '확인 필요' : '이상 없음'} />
          <MetricCard value={summary.dangerCount} label="위험 종목" valueColor={dangerColor} sub={summary.dangerCount === 0 ? '이상 없음' : '즉시 확인'} />
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 300px', gap: 14 }}>
          <div style={{ background: 'var(--color-bg-primary)', border: '0.5px solid var(--color-border-tertiary)', borderRadius: 'var(--radius-lg)', overflow: 'hidden' }}>
            <div style={{ padding: '12px 16px', borderBottom: '0.5px solid var(--color-border-tertiary)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: 13, fontWeight: 500, letterSpacing: '-0.03em' }}>워치리스트</span>
              <span style={{ fontSize: 11, color: 'var(--color-text-tertiary)', letterSpacing: '-0.02em' }}>
                공시·리스크는 dev DB 기준
              </span>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 90px 72px 80px 100px', padding: '7px 16px', background: 'var(--color-bg-secondary)', gap: 8 }}>
              {['종목', '현재가', '등락', '리스크', '작전주 지수'].map((h, i) => (
                <span key={h} style={{ fontSize: 10.5, color: 'var(--color-text-tertiary)', fontWeight: 500, letterSpacing: '-0.01em', textAlign: i >= 1 && i <= 2 ? 'right' : i === 3 ? 'center' : 'left' }}>{h}</span>
              ))}
            </div>
            {state.loadStatus.state === 'loading' && (
              <div style={{ padding: '28px 16px', textAlign: 'center', color: 'var(--color-text-tertiary)', fontSize: 13 }}>
                dev DB에서 워치리스트를 불러오는 중입니다.
              </div>
            )}
            {state.loadStatus.state === 'error' && (
              <div style={{ padding: '28px 16px', textAlign: 'center', color: '#A32D2D', fontSize: 13 }}>
                {state.loadStatus.message}
              </div>
            )}
            {state.loadStatus.state !== 'loading' &&
              state.loadStatus.state !== 'error' &&
              watchlist.map(item => (
                <div key={item.corp_code} style={{ display: 'grid', gridTemplateColumns: '1fr 90px 72px 80px 100px', padding: '10px 16px', borderBottom: '0.5px solid var(--color-border-tertiary)', alignItems: 'center', gap: 8 }}>
                  <div>
                    <p style={{ fontSize: 13, fontWeight: 500, letterSpacing: '-0.03em' }}>{item.corp_name}</p>
                    <p className="font-mono" style={{ fontSize: 10, color: 'var(--color-text-tertiary)' }}>{item.stock_code} · {item.market}</p>
                  </div>
                  <p className="font-mono" style={{ fontSize: 13, fontWeight: 500, textAlign: 'right' }}>
                    {typeof item.price === 'number' ? item.price.toLocaleString() : '—'}
                  </p>
                  <p
                    className="font-mono"
                    style={{
                      fontSize: 12,
                      textAlign: 'right',
                      color:
                        typeof item.change_rate !== 'number'
                          ? 'var(--color-text-tertiary)'
                          : item.change_rate >= 0
                            ? '#E24B4A'
                            : '#185FA5',
                    }}
                  >
                    {formatSignedRate(item.change_rate)}
                  </p>
                  <div style={{ display: 'flex', justifyContent: 'center' }}>
                    <RiskBadge level={item.risk_level ?? 'normal'} size="sm" />
                  </div>
                  <RiskProgressBar score={item.risk_score ?? 0} level={item.risk_level ?? 'normal'} />
                </div>
              ))}
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div style={{ background: 'var(--color-bg-primary)', border: '0.5px solid var(--color-border-tertiary)', borderRadius: 'var(--radius-lg)', overflow: 'hidden' }}>
              <div style={{ padding: '12px 16px', borderBottom: '0.5px solid var(--color-border-tertiary)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontSize: 13, fontWeight: 500, letterSpacing: '-0.03em' }}>최근 공시 알림</span>
                <span style={{ fontSize: 11, color: 'var(--color-text-tertiary)' }}>backend BFF 경유</span>
              </div>
              {state.loadStatus.state === 'loading' && (
                <div style={{ padding: '20px 14px', color: 'var(--color-text-tertiary)', fontSize: 12 }}>
                  최근 공시 알림을 불러오는 중입니다.
                </div>
              )}
              {state.loadStatus.state === 'error' && (
                <div style={{ padding: '20px 14px', color: '#A32D2D', fontSize: 12 }}>
                  {state.loadStatus.message}
                </div>
              )}
              {state.loadStatus.state === 'ready' && alerts.length === 0 && (
                <div style={{ padding: '20px 14px', color: 'var(--color-text-tertiary)', fontSize: 12 }}>
                  dev DB에 아직 표시할 최근 공시가 없습니다.
                </div>
              )}
              {state.loadStatus.state === 'ready' && alerts.map(a => {
                const badge = ALERT_BADGE[a.risk_level] ?? ALERT_BADGE.info
                return (
                  <div key={a.id} style={{ padding: '12px 14px', borderBottom: '0.5px solid var(--color-border-tertiary)', cursor: 'pointer' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                      <span style={{ fontSize: 10, fontWeight: 500, padding: '2px 8px', borderRadius: 100, background: badge.bg, color: badge.color }}>{badge.label}</span>
                      <span className="font-mono" style={{ fontSize: 10, color: 'var(--color-text-tertiary)' }}>{a.time}</span>
                    </div>
                    <p style={{ fontSize: 13, fontWeight: 500, letterSpacing: '-0.03em', marginTop: 2 }}>{a.corp_name}</p>
                    <p style={{ fontSize: 12, color: 'var(--color-text-primary)', letterSpacing: '-0.02em', marginTop: 2 }}>
                      {a.title}
                    </p>
                    <p style={{ fontSize: 11, color: 'var(--color-text-secondary)', letterSpacing: '-0.02em', lineHeight: 1.45, marginTop: 2 }}>{a.description}</p>
                  </div>
                )
              })}
            </div>

            <div style={{ background: 'var(--color-bg-primary)', border: '0.5px solid var(--color-border-tertiary)', borderRadius: 'var(--radius-lg)', padding: '14px 16px' }}>
              <p style={{ fontSize: 13, fontWeight: 500, letterSpacing: '-0.03em', marginBottom: 12 }}>포트폴리오 리스크</p>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--color-text-tertiary)', marginBottom: 5 }}>
                    <span>전체 위험도</span>
                    <span className="font-mono">{averageRisk.toFixed(1)} / 6</span>
                  </div>
                  <div style={{ height: 6, background: 'var(--color-bg-secondary)', borderRadius: 100, overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${Math.min((averageRisk / 6) * 100, 100)}%`, background: summary.dangerCount > 0 ? '#E24B4A' : summary.cautionCount > 0 ? '#BA7517' : '#639922', borderRadius: 100 }} />
                  </div>
                </div>
                <RiskBadge level={summary.dangerCount > 0 ? 'high' : summary.cautionCount > 0 ? 'caution' : 'normal'} size="sm" />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 6, textAlign: 'center' }}>
                {[
                  { count: normalCount, label: '안전', bg: '#EAF3DE', color: '#3B6D11' },
                  { count: summary.cautionCount, label: '주의', bg: '#FAEEDA', color: '#854F0B' },
                  { count: summary.dangerCount, label: '위험', bg: '#FCEBEB', color: '#A32D2D' },
                ].map(({ count, label, bg, color }) => (
                  <div key={label} style={{ background: bg, borderRadius: 'var(--radius-md)', padding: '8px 4px' }}>
                    <p className="font-mono" style={{ fontSize: 16, fontWeight: 500, color }}>{count}</p>
                    <p style={{ fontSize: 10, color, letterSpacing: '-0.01em' }}>{label}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
