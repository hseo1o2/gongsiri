'use client'

import { useState } from 'react'
import { IconTrash } from '@tabler/icons-react'
import Topbar from '@/components/layout/Topbar'
import RiskBadge from '@/components/ui/RiskBadge'
import RiskProgressBar from '@/components/ui/RiskProgressBar'
import { useDemoSession } from '@/lib/demo-session'
import AddStockModal from './_components/AddStockModal'

export default function WatchlistPage() {
  const { dispatch, state, watchlist } = useDemoSession()
  const [showModal, setShowModal] = useState(false)

  function removeItem(corpCode: string) {
    dispatch({ type: 'watchlist/remove', corpCode })
  }

  return (
    <div>
      <Topbar title="워치리스트" ctaLabel="종목 추가" onCta={() => setShowModal(true)} />
      {showModal && <AddStockModal onClose={() => setShowModal(false)} />}

      <div style={{ padding: 16 }}>
        {state.addStatus.message && (
          <div style={{ background: state.addStatus.state === 'added' ? '#EAF3DE' : '#FAEEDA', borderLeft: `3px solid ${state.addStatus.state === 'added' ? '#639922' : '#BA7517'}`, padding: '10px 14px', marginBottom: 12, borderRadius: 'var(--radius-md)' }}>
            <p style={{ fontSize: 12, color: state.addStatus.state === 'added' ? '#3B6D11' : '#854F0B', letterSpacing: '-0.02em' }}>
              {state.addStatus.message}
            </p>
          </div>
        )}
        <div style={{ background: 'var(--color-bg-primary)', border: '0.5px solid var(--color-border-tertiary)', borderRadius: 'var(--radius-lg)', overflow: 'hidden' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 90px 72px 80px 120px 40px', padding: '7px 16px', background: 'var(--color-bg-secondary)', gap: 8 }}>
            {['종목', '현재가', '등락', '리스크', '작전주 지수', ''].map((h, i) => (
              <span key={i} style={{ fontSize: 10.5, color: 'var(--color-text-tertiary)', fontWeight: 500, textAlign: i >= 1 && i <= 2 ? 'right' : 'left' }}>{h}</span>
            ))}
          </div>
          {watchlist.length === 0 ? (
            <div style={{ padding: '28px 16px', textAlign: 'center', color: 'var(--color-text-tertiary)', fontSize: 13, letterSpacing: '-0.02em' }}>
              등록된 워치리스트 종목이 없습니다.
            </div>
          ) : watchlist.map(item => (
            <div key={item.corp_code} style={{ display: 'grid', gridTemplateColumns: '1fr 90px 72px 80px 120px 40px', padding: '12px 16px', borderBottom: '0.5px solid var(--color-border-tertiary)', alignItems: 'center', gap: 8 }}>
              <div>
                <p style={{ fontSize: 13, fontWeight: 500 }}>{item.corp_name}</p>
                <p className="font-mono" style={{ fontSize: 10, color: 'var(--color-text-tertiary)' }}>{item.stock_code} · {item.market}</p>
              </div>
              <p className="font-mono" style={{ fontSize: 13, fontWeight: 500, textAlign: 'right' }}>{item.price?.toLocaleString()}</p>
              <p className="font-mono" style={{ fontSize: 12, textAlign: 'right', color: (item.change_rate ?? 0) >= 0 ? '#E24B4A' : '#185FA5' }}>
                {(item.change_rate ?? 0) >= 0 ? '▲' : '▼'} {Math.abs(item.change_rate ?? 0)}%
              </p>
              <RiskBadge level={item.risk_level ?? 'normal'} size="sm" />
              <RiskProgressBar score={item.risk_score ?? 0} level={item.risk_level ?? 'normal'} />
              <button onClick={() => removeItem(item.corp_code)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-text-tertiary)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <IconTrash size={14} />
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
