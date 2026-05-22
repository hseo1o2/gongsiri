'use client'
import MarkdownContent from '@/components/ui/MarkdownContent'

interface Props {
  title: string
  content: string
  variant?: 'normal' | 'warning'
}

export default function ReportSection({ title, content, variant = 'normal' }: Props) {
  const isWarning = variant === 'warning'
  return (
    <div style={{
      background: isWarning ? '#FCEBEB' : 'var(--color-bg-primary)',
      border: `0.5px solid ${isWarning ? '#E24B4A' : 'var(--color-border-tertiary)'}`,
      borderRadius: 'var(--radius-lg)',
      overflow: 'hidden',
    }}>
      <div style={{ padding: '12px 16px', borderBottom: `0.5px solid ${isWarning ? '#F5C0C0' : 'var(--color-border-tertiary)'}` }}>
        <span style={{ fontSize: 13, fontWeight: 500, letterSpacing: '-0.03em', color: isWarning ? '#A32D2D' : 'var(--color-text-primary)' }}>{title}</span>
      </div>
      <div style={{ padding: '14px 16px', fontSize: 14, lineHeight: 1.7, letterSpacing: '-0.02em', color: isWarning ? '#791F1F' : 'var(--color-text-primary)' }}>
        <MarkdownContent content={content} tone={isWarning ? 'warning' : 'normal'} />
      </div>
    </div>
  )
}
