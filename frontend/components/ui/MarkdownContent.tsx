import type { ReactNode } from 'react'
import ReactMarkdown from 'react-markdown'

const ALLOWED_MARKDOWN_ELEMENTS = [
  'a',
  'blockquote',
  'br',
  'code',
  'em',
  'h1',
  'h2',
  'h3',
  'h4',
  'hr',
  'li',
  'ol',
  'p',
  'pre',
  'strong',
  'table',
  'tbody',
  'td',
  'th',
  'thead',
  'tr',
  'ul',
] as const

interface Props {
  content: string
  tone?: 'normal' | 'muted' | 'warning'
}

function toneColor(tone: Props['tone']) {
  if (tone === 'warning') return '#791F1F'
  if (tone === 'muted') return 'var(--color-text-secondary)'
  return 'var(--color-text-primary)'
}

function flattenText(children: ReactNode): string {
  if (typeof children === 'string') return children
  if (typeof children === 'number') return String(children)
  if (Array.isArray(children)) return children.map(flattenText).join('')
  if (children && typeof children === 'object' && 'props' in children) {
    return flattenText((children as { props?: { children?: ReactNode } }).props?.children ?? '')
  }
  return ''
}

function parsePipeTable(markdown: string): { header: string[]; rows: string[][] } | null {
  const lines = markdown
    .split('\n')
    .map(line => line.trim())
    .filter(Boolean)
  if (lines.length < 3) return null
  if (!lines.every(line => line.startsWith('|') && line.endsWith('|'))) return null
  if (!/^\|(?:\s*:?-{3,}:?\s*\|)+$/.test(lines[1])) return null

  const cells = (line: string) =>
    line
      .slice(1, -1)
      .split('|')
      .map(cell => cell.trim())

  return {
    header: cells(lines[0]),
    rows: lines.slice(2).map(cells),
  }
}

export default function MarkdownContent({ content, tone = 'normal' }: Props) {
  const color = toneColor(tone)

  return (
    <ReactMarkdown
      skipHtml
      allowedElements={[...ALLOWED_MARKDOWN_ELEMENTS]}
      components={{
        h1: ({ children }) => <h3 style={{ fontSize: 18, fontWeight: 700, letterSpacing: '-0.03em', margin: '0 0 10px', color }}>{children}</h3>,
        h2: ({ children }) => <h4 style={{ fontSize: 16, fontWeight: 700, letterSpacing: '-0.03em', margin: '0 0 8px', color }}>{children}</h4>,
        h3: ({ children }) => <h5 style={{ fontSize: 14, fontWeight: 600, letterSpacing: '-0.02em', margin: '0 0 8px', color }}>{children}</h5>,
        h4: ({ children }) => <h6 style={{ fontSize: 13, fontWeight: 600, letterSpacing: '-0.02em', margin: '0 0 6px', color }}>{children}</h6>,
        p: ({ children }) => {
          const table = parsePipeTable(flattenText(children))
          if (table) {
            return (
              <div style={{ overflowX: 'auto', marginBottom: 10 }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12, color }}>
                  <thead style={{ background: 'var(--color-bg-secondary)' }}>
                    <tr>
                      {table.header.map(cell => (
                        <th key={cell} style={{ textAlign: 'left', padding: '8px 10px', border: '0.5px solid var(--color-border-tertiary)' }}>
                          {cell}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {table.rows.map((row, rowIndex) => (
                      <tr key={`${row.join('|')}-${rowIndex}`}>
                        {row.map((cell, cellIndex) => (
                          <td key={`${cell}-${cellIndex}`} style={{ padding: '8px 10px', border: '0.5px solid var(--color-border-tertiary)' }}>
                            {cell}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )
          }
          return <p style={{ margin: '0 0 10px', lineHeight: 1.7, color }}>{children}</p>
        },
        ul: ({ children }) => <ul style={{ margin: '0 0 10px', paddingLeft: 20, color }}>{children}</ul>,
        ol: ({ children }) => <ol style={{ margin: '0 0 10px', paddingLeft: 20, color }}>{children}</ol>,
        li: ({ children }) => <li style={{ marginBottom: 4 }}>{children}</li>,
        blockquote: ({ children }) => (
          <blockquote style={{ margin: '0 0 10px', padding: '8px 12px', borderLeft: '3px solid #3B8BFF', background: '#F6FAFF', color }}>
            {children}
          </blockquote>
        ),
        a: ({ href, children }) => (
          <a
            href={href}
            target="_blank"
            rel="noreferrer noopener"
            style={{ color: '#185FA5', textDecoration: 'underline' }}
          >
            {children}
          </a>
        ),
        hr: () => <hr style={{ border: 0, borderTop: '0.5px solid var(--color-border-tertiary)', margin: '12px 0' }} />,
        code: ({ children }) => (
          <code style={{ fontFamily: 'SFMono-Regular, Menlo, monospace', fontSize: '0.92em', background: 'var(--color-bg-secondary)', padding: '2px 5px', borderRadius: 4, color }}>
            {children}
          </code>
        ),
        pre: ({ children }) => (
          <pre style={{ margin: '0 0 10px', padding: '10px 12px', overflowX: 'auto', borderRadius: 8, background: 'var(--color-bg-secondary)', color }}>
            {children}
          </pre>
        ),
        table: ({ children }) => (
          <div style={{ overflowX: 'auto', marginBottom: 10 }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12, color }}>{children}</table>
          </div>
        ),
        thead: ({ children }) => <thead style={{ background: 'var(--color-bg-secondary)' }}>{children}</thead>,
        th: ({ children }) => <th style={{ textAlign: 'left', padding: '8px 10px', border: '0.5px solid var(--color-border-tertiary)' }}>{children}</th>,
        td: ({ children }) => <td style={{ padding: '8px 10px', border: '0.5px solid var(--color-border-tertiary)' }}>{children}</td>,
      }}
    >
      {content}
    </ReactMarkdown>
  )
}

export { ALLOWED_MARKDOWN_ELEMENTS }
