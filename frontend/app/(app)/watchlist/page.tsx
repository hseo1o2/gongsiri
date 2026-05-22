'use client'

import { useState } from 'react'
import { IconTrash } from '@tabler/icons-react'
import Topbar from '@/components/layout/Topbar'
import RiskBadge from '@/components/ui/RiskBadge'
import RiskProgressBar from '@/components/ui/RiskProgressBar'
import { useDemoSession } from '@/lib/demo-session'
import AddStockModal from './_components/AddStockModal'

export default function WatchlistPage() {
  const { removeWatchlistItem, state, watchlist } = useDemoSession()
  const [showModal, setShowModal] = useState(false)
  const [mutationError, setMutationError] = useState('')

  async function removeItem(corpCode: string) {
    try {
      setMutationError('')
      await removeWatchlistItem(corpCode)
    } catch (cause) {
      setMutationError(
        cause instanceof Error ? cause.message : '저 공시리가 워치리스트를 삭제하지 못했습니다.',
      )
    }
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
        {mutationError && (
          <div style={{ background: '#FCEBEB', borderLeft: '3px solid #E24B4A', padding: '10px 14px', marginBottom: 12, borderRadius: 'var(--radius-md)' }}>
            <p style={{ fontSize: 12, color: '#A32D2D', letterSpacing: '-0.02em' }}>{mutationError}</p>
          </div>
        )}
        <div style={{ background: 'var(--color-bg-primary)', border: '0.5px solid var(--color-border-tertiary)', borderRadius: 'var(--radius-lg)', overflow: 'hidden' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 90px 72px 80px 120px 40px', padding: '7px 16px', background: 'var(--color-bg-secondary)', gap: 8 }}>
            {['종목', '현재가', '등락', '리스크', '작전주 지수', ''].map((h, i) => (
              <span key={i} style={{ fontSize: 10.5, color: 'var(--color-text-tertiary)', fontWeight: 500, textAlign: i >= 1 && i <= 2 ? 'right' : 'left' }}>{h}</span>
            ))}
          </div>
          {state.loadStatus.state === 'loading' ? (
            <div style={{ padding: '28px 16px', textAlign: 'center', color: 'var(--color-text-tertiary)', fontSize: 13, letterSpacing: '-0.02em' }}>
              dev DB 워치리스트를 불러오는 중입니다.
            </div>
          ) : state.loadStatus.state === 'error' ? (
            <div style={{ padding: '28px 16px', textAlign: 'center', color: '#A32D2D', fontSize: 13, letterSpacing: '-0.02em' }}>
              {state.loadStatus.message}
            </div>
          ) : watchlist.length === 0 ? (
            <div style={{ padding: '28px 16px', textAlign: 'center', color: 'var(--color-text-tertiary)', fontSize: 13, letterSpacing: '-0.02em' }}>
              등록된 워치리스트 종목이 없습니다.
            </div>
          ) : watchlist.map(item => (
            <div key={item.corp_code} style={{ display: 'grid', gridTemplateColumns: '1fr 90px 72px 80px 120px 40px', padding: '12px 16px', borderBottom: '0.5px solid var(--color-border-tertiary)', alignItems: 'center', gap: 8 }}>
              <div>
                <p style={{ fontSize: 13, fontWeight: 500 }}>{item.corp_name}</p>
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
                {typeof item.change_rate === 'number'
                  ? `${item.change_rate >= 0 ? '▲' : '▼'} ${Math.abs(item.change_rate)}%`
                  : '—'}
              </p>
              <RiskBadge level={item.risk_level ?? 'normal'} size="sm" />
              <RiskProgressBar score={item.risk_score ?? 0} level={item.risk_level ?? 'normal'} />
              <button onClick={() => void removeItem(item.corp_code)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-text-tertiary)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <IconTrash size={14} />
              </button>
            </div>
          ))}
        </div>
        <p style={{ marginTop: 10, fontSize: 11, color: 'var(--color-text-tertiary)', letterSpacing: '-0.02em' }}>
          종목 등록/삭제는 backend BFF를 거쳐 dev DB에 저장됩니다. 현재가·등락은 아직 연결 전이라 비워 둡니다.
        </p>
      </div>
    </div>
  )
}
