'use client'
import { useState } from 'react'
import Topbar from '@/components/layout/Topbar'
import RiskBadge from '@/components/ui/RiskBadge'
import type { PortfolioItem, RiskLevel } from '@/lib/types'

const MOCK: PortfolioItem[] = [
  { corp_code: '00258801', corp_name: '카카오', stock_code: '035720', quantity: 10, avg_price: 40000, risk_level: 'caution', risk_score: 2 },
  { corp_code: '00126380', corp_name: '삼성전자', stock_code: '005930', quantity: 5, avg_price: 72000, risk_level: 'normal', risk_score: 0 },
]

export default function PortfolioPage() {
  const [items] = useState<PortfolioItem[]>(MOCK)

  const totalValue = items.reduce((sum, i) => sum + i.quantity * i.avg_price, 0)
  const weightedScore = items.reduce((sum, i) => {
    const weight = (i.quantity * i.avg_price) / totalValue
    return sum + (i.risk_score ?? 0) * weight
  }, 0)

  const overallLevel: RiskLevel = weightedScore >= 4 ? 'high' : weightedScore >= 2 ? 'caution' : 'normal'

  return (
    <div>
      <Topbar title="포트폴리오" showSearch={false} ctaLabel="종목 추가" />
      <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 14 }}>

        {/* Risk Summary */}
        <div style={{ background: 'var(--color-bg-primary)', border: '0.5px solid var(--color-border-tertiary)', borderRadius: 'var(--radius-lg)', padding: '16px 20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
            <p style={{ fontSize: 13, fontWeight: 500, letterSpacing: '-0.03em' }}>포트폴리오 전체 리스크</p>
            <RiskBadge level={overallLevel} />
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--color-text-tertiary)', marginBottom: 5 }}>
            <span>가중 평균 위험도</span>
            <span className="font-mono">{weightedScore.toFixed(1)} / 6</span>
          </div>
          <div style={{ height: 6, background: 'var(--color-bg-secondary)', borderRadius: 100, overflow: 'hidden' }}>
            <div style={{ height: '100%', width: `${(weightedScore / 6) * 100}%`, background: overallLevel === 'high' ? '#E24B4A' : overallLevel === 'caution' ? '#BA7517' : '#639922', borderRadius: 100 }} />
          </div>
        </div>

        {/* Holdings */}
        <div style={{ background: 'var(--color-bg-primary)', border: '0.5px solid var(--color-border-tertiary)', borderRadius: 'var(--radius-lg)', overflow: 'hidden' }}>
          <div style={{ padding: '12px 16px', borderBottom: '0.5px solid var(--color-border-tertiary)' }}>
            <span style={{ fontSize: 13, fontWeight: 500 }}>보유 종목</span>
          </div>
          {items.map((item, i) => {
            const value = item.quantity * item.avg_price
            const weight = ((value / totalValue) * 100).toFixed(0)
            return (
              <div key={item.corp_code} style={{ padding: '12px 16px', borderBottom: i < items.length - 1 ? '0.5px solid var(--color-border-tertiary)' : 'none', display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{ flex: 1 }}>
                  <p style={{ fontSize: 13, fontWeight: 500 }}>{item.corp_name}</p>
                  <p className="font-mono" style={{ fontSize: 10, color: 'var(--color-text-tertiary)', marginTop: 2 }}>{item.stock_code} · {item.quantity}주 · 비중 {weight}%</p>
                </div>
                <RiskBadge level={item.risk_level ?? 'normal'} size="sm" />
                <p className="font-mono" style={{ fontSize: 13, fontWeight: 500, minWidth: 80, textAlign: 'right' }}>
                  {value.toLocaleString()}원
                </p>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
