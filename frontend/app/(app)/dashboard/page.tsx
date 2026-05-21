import Topbar from '@/components/layout/Topbar'
import MetricCard from '@/components/ui/MetricCard'
import RiskBadge from '@/components/ui/RiskBadge'
import RiskProgressBar from '@/components/ui/RiskProgressBar'
import type { WatchlistItem, DisclosureAlert } from '@/lib/types'

async function getWatchlistSummary() {
  return { count: 12, todayDisclosures: 3, cautionCount: 1, dangerCount: 0 }
}

async function getWatchlist(): Promise<WatchlistItem[]> {
  return [
    { corp_code: '00258801', corp_name: '카카오', stock_code: '035720', market: 'KOSPI', price: 42650, change_rate: 1.2, risk_level: 'caution', risk_score: 2 },
    { corp_code: '00126380', corp_name: '삼성전자', stock_code: '005930', market: 'KOSPI', price: 75400, change_rate: -0.5, risk_level: 'normal', risk_score: 0 },
    { corp_code: '00247540', corp_name: '에코프로비엠', stock_code: '247540', market: 'KOSDAQ', price: 128900, change_rate: 3.8, risk_level: 'normal', risk_score: 1 },
    { corp_code: '00068270', corp_name: '셀트리온', stock_code: '068270', market: 'KOSPI', price: 162000, change_rate: -1.1, risk_level: 'normal', risk_score: 1 },
    { corp_code: '00999999', corp_name: '코스피소형', stock_code: '999999', market: 'KOSDAQ', price: 3450, change_rate: 5.9, risk_level: 'high', risk_score: 4 },
  ]
}

async function getRecentAlerts(): Promise<DisclosureAlert[]> {
  return [
    { id: '1', corp_name: '코스피소형', risk_level: 'high', title: '작전주 징후 4점 이상 감지', description: 'CB 3회·최대주주 변경 2회·비정상 급등 검출', time: '09:14' },
    { id: '2', corp_name: '카카오', risk_level: 'caution', title: '주요사항보고서 신규 공시', description: 'CB 추가 발행 검토 내용 포함', time: '08:52' },
    { id: '3', corp_name: '삼성전자', risk_level: 'info', title: '분기보고서', description: '이상 시그널 없음, 분석 완료', time: '08:30' },
  ]
}

const ALERT_BADGE: Record<string, { label: string; bg: string; color: string }> = {
  high:    { label: '위험', bg: '#FCEBEB', color: '#A32D2D' },
  caution: { label: '주의', bg: '#FAEEDA', color: '#854F0B' },
  info:    { label: '공시', bg: '#E6F1FB', color: '#185FA5' },
}

export default async function DashboardPage() {
  const [summary, watchlist, alerts] = await Promise.all([
    getWatchlistSummary(), getWatchlist(), getRecentAlerts(),
  ])

  const dangerColor = summary.dangerCount > 0 ? '#E24B4A' : '#639922'
  const cautionColor = summary.cautionCount > 0 ? '#BA7517' : 'var(--color-text-primary)'

  return (
    <div>
      <Topbar title="대시보드" ctaLabel="종목 추가" />
      <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 14 }}>

        {/* Metrics */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 10 }}>
          <MetricCard value={summary.count} label="모니터링 종목" />
          <MetricCard value={summary.todayDisclosures} label="오늘 신규 공시" valueColor="#E24B4A" sub="▲ 어제 대비 +2" />
          <MetricCard value={summary.cautionCount} label="주의 종목" valueColor={cautionColor} sub="카카오" />
          <MetricCard value={summary.dangerCount} label="위험 종목" valueColor={dangerColor} sub={summary.dangerCount === 0 ? '이상 없음' : undefined} />
        </div>

        {/* Main Grid */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 300px', gap: 14 }}>

          {/* Watchlist Table */}
          <div style={{ background: 'var(--color-bg-primary)', border: '0.5px solid var(--color-border-tertiary)', borderRadius: 'var(--radius-lg)', overflow: 'hidden' }}>
            <div style={{ padding: '12px 16px', borderBottom: '0.5px solid var(--color-border-tertiary)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: 13, fontWeight: 500, letterSpacing: '-0.03em' }}>워치리스트</span>
              <button style={{ fontSize: 11, color: '#3B8BFF', background: 'none', border: 'none', cursor: 'pointer', letterSpacing: '-0.02em' }}>전체 보기 →</button>
            </div>
            {/* Header */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 90px 72px 80px 100px', padding: '7px 16px', background: 'var(--color-bg-secondary)', gap: 8 }}>
              {['종목', '현재가', '등락', '리스크', '작전주 지수'].map((h, i) => (
                <span key={h} style={{ fontSize: 10.5, color: 'var(--color-text-tertiary)', fontWeight: 500, letterSpacing: '-0.01em', textAlign: i >= 1 && i <= 2 ? 'right' : i === 3 ? 'center' : 'left' }}>{h}</span>
              ))}
            </div>
            {watchlist.map(item => (
              <div key={item.corp_code} style={{ display: 'grid', gridTemplateColumns: '1fr 90px 72px 80px 100px', padding: '10px 16px', borderBottom: '0.5px solid var(--color-border-tertiary)', alignItems: 'center', gap: 8 }}>
                <div>
                  <p style={{ fontSize: 13, fontWeight: 500, letterSpacing: '-0.03em' }}>{item.corp_name}</p>
                  <p className="font-mono" style={{ fontSize: 10, color: 'var(--color-text-tertiary)' }}>{item.stock_code} · {item.market}</p>
                </div>
                <p className="font-mono" style={{ fontSize: 13, fontWeight: 500, textAlign: 'right' }}>{item.price?.toLocaleString()}</p>
                <p className="font-mono" style={{ fontSize: 12, textAlign: 'right', color: (item.change_rate ?? 0) >= 0 ? '#E24B4A' : '#185FA5' }}>
                  {(item.change_rate ?? 0) >= 0 ? '▲' : '▼'} {Math.abs(item.change_rate ?? 0)}%
                </p>
                <div style={{ display: 'flex', justifyContent: 'center' }}>
                  <RiskBadge level={item.risk_level ?? 'normal'} size="sm" />
                </div>
                <RiskProgressBar score={item.risk_score ?? 0} level={item.risk_level ?? 'normal'} />
              </div>
            ))}
          </div>

          {/* Right Panel */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {/* Alerts */}
            <div style={{ background: 'var(--color-bg-primary)', border: '0.5px solid var(--color-border-tertiary)', borderRadius: 'var(--radius-lg)', overflow: 'hidden' }}>
              <div style={{ padding: '12px 16px', borderBottom: '0.5px solid var(--color-border-tertiary)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontSize: 13, fontWeight: 500, letterSpacing: '-0.03em' }}>최근 공시 알림</span>
                <button style={{ fontSize: 11, color: '#3B8BFF', background: 'none', border: 'none', cursor: 'pointer' }}>전체 →</button>
              </div>
              {alerts.map(a => {
                const badge = ALERT_BADGE[a.risk_level] ?? ALERT_BADGE.info
                return (
                  <div key={a.id} style={{ padding: '12px 14px', borderBottom: '0.5px solid var(--color-border-tertiary)', cursor: 'pointer' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                      <span style={{ fontSize: 10, fontWeight: 500, padding: '2px 8px', borderRadius: 100, background: badge.bg, color: badge.color }}>{badge.label}</span>
                      <span className="font-mono" style={{ fontSize: 10, color: 'var(--color-text-tertiary)' }}>{a.time}</span>
                    </div>
                    <p style={{ fontSize: 13, fontWeight: 500, letterSpacing: '-0.03em', marginTop: 2 }}>{a.corp_name}</p>
                    <p style={{ fontSize: 11, color: 'var(--color-text-secondary)', letterSpacing: '-0.02em', lineHeight: 1.45, marginTop: 2 }}>{a.description}</p>
                  </div>
                )
              })}
            </div>

            {/* Portfolio Risk */}
            <div style={{ background: 'var(--color-bg-primary)', border: '0.5px solid var(--color-border-tertiary)', borderRadius: 'var(--radius-lg)', padding: '14px 16px' }}>
              <p style={{ fontSize: 13, fontWeight: 500, letterSpacing: '-0.03em', marginBottom: 12 }}>포트폴리오 리스크</p>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--color-text-tertiary)', marginBottom: 5 }}>
                    <span>전체 위험도</span>
                    <span className="font-mono">2.1 / 6</span>
                  </div>
                  <div style={{ height: 6, background: 'var(--color-bg-secondary)', borderRadius: 100, overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: '35%', background: '#BA7517', borderRadius: 100 }} />
                  </div>
                </div>
                <RiskBadge level="caution" size="sm" />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 6, textAlign: 'center' }}>
                {[
                  { count: 10, label: '안전', bg: '#EAF3DE', color: '#3B6D11' },
                  { count: 1, label: '주의', bg: '#FAEEDA', color: '#854F0B' },
                  { count: 1, label: '위험', bg: '#FCEBEB', color: '#A32D2D' },
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
