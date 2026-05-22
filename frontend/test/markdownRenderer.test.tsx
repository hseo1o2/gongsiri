import assert from 'node:assert/strict'
import test from 'node:test'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import MarkdownContent, { ALLOWED_MARKDOWN_ELEMENTS } from '../components/ui/MarkdownContent'

test('markdown renderer allowlist includes headings, lists, tables, code, and links', () => {
  assert.deepEqual(
    ['h1', 'h2', 'ul', 'ol', 'table', 'code', 'a'].map(item => ALLOWED_MARKDOWN_ELEMENTS.includes(item as never)),
    [true, true, true, true, true, true, true],
  )
})

test('markdown renderer renders structured markdown safely', () => {
  const html = renderToStaticMarkup(
    <MarkdownContent content={`## 제목\n\n- 항목\n\n| A | B |\n| --- | --- |\n| 1 | 2 |\n\n[링크](https://example.com)\n\n\`code\``} />,
  )

  assert.match(html, /<h4/)
  assert.match(html, /<ul/)
  assert.match(html, /<table/)
  assert.match(html, /<a[^>]*href="https:\/\/example.com"/)
  assert.match(html, /<code/)
})

test('markdown renderer skips raw html instead of executing it', () => {
  const html = renderToStaticMarkup(
    <MarkdownContent content={`안전한 문장\n\n<script>alert('xss')</script>\n\n<div>raw html</div>`} />,
  )

  assert.match(html, /안전한 문장/)
  assert.doesNotMatch(html, /<script/)
  assert.doesNotMatch(html, /raw html<\/div>/)
})
