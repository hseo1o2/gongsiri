'use client'
import { useState } from 'react'
import { IconChevronDown, IconChevronUp } from '@tabler/icons-react'
import MarkdownContent from '@/components/ui/MarkdownContent'
import type { ChecklistItem } from '@/lib/types'

const ICON_STYLE = {
  pass:    { bg: '#EAF3DE', color: '#3B6D11', symbol: '✓' },
  fail:    { bg: '#FCEBEB', color: '#A32D2D', symbol: '✗' },
  unknown: { bg: '#F0F0F0', color: '#8a8a8a', symbol: '–' },
}

function ChecklistRow({ item }: { item: ChecklistItem }) {
  const [open, setOpen] = useState(false)
  const s = ICON_STYLE[item.status]

  return (
    <div style={{ borderBottom: '0.5px solid var(--color-border-tertiary)' }}>
      <div
        onClick={() => setOpen(o => !o)}
        style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 16px', cursor: 'pointer' }}
      >
        <div style={{ width: 20, height: 20, borderRadius: '50%', background: s.bg, color: s.color, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, flexShrink: 0, fontWeight: 700 }}>
          {s.symbol}
        </div>
        <span style={{ flex: 1, fontSize: 13, letterSpacing: '-0.03em' }}>{item.title}</span>
        <span className="font-mono" style={{ fontSize: 11, color: 'var(--color-text-tertiary)' }}>
          {item.status === 'unknown' ? '확인불가' : item.score > 0 ? `${item.score}점` : '이상없음'}
        </span>
        {open ? <IconChevronUp size={13} color="var(--color-text-tertiary)" /> : <IconChevronDown size={13} color="var(--color-text-tertiary)" />}
      </div>

      {open && (
        <div style={{ padding: '0 16px 12px 46px', display: 'flex', flexDirection: 'column', gap: 6 }}>
          {item.solar_explanation && (
            <div style={{ fontSize: 12, lineHeight: 1.6, letterSpacing: '-0.02em' }}>
              <MarkdownContent content={item.solar_explanation} tone="muted" />
            </div>
          )}
          {item.evidence.length > 0 && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
              {item.evidence.map((e, i) => (
                <span key={i} className="font-mono" style={{ fontSize: 10, background: '#EBF2FF', color: '#3B8BFF', padding: '2px 7px', borderRadius: 4 }}>{e}</span>
              ))}
            </div>
          )}
          {!item.solar_explanation && item.evidence.length === 0 && (
            <p style={{ fontSize: 12, color: 'var(--color-text-tertiary)' }}>{item.reason}</p>
          )}
        </div>
      )}
    </div>
  )
}

export default function ChecklistPanel({ checklist }: { checklist: ChecklistItem[] }) {
  return (
    <div style={{ background: 'var(--color-bg-primary)', border: '0.5px solid var(--color-border-tertiary)', borderRadius: 'var(--radius-lg)', overflow: 'hidden' }}>
      <div style={{ padding: '12px 16px', borderBottom: '0.5px solid var(--color-border-tertiary)' }}>
        <span style={{ fontSize: 13, fontWeight: 500, letterSpacing: '-0.03em' }}>작전주 6개 항목 판별</span>
      </div>
      {checklist.map(item => <ChecklistRow key={item.id} item={item} />)}
    </div>
  )
}
