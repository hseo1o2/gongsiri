'use client'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import {
  IconLayoutDashboard, IconEye, IconBell,
  IconFileAnalytics, IconChartPie, IconMessage2,
  IconSettings, IconLogout,
} from '@tabler/icons-react'

const NAV = [
  {
    section: '메인',
    items: [
      { href: '/dashboard', label: '대시보드', icon: IconLayoutDashboard },
      { href: '/watchlist', label: '워치리스트', icon: IconEye, badge: 'watchlist' },
      { href: '/disclosures', label: '공시 알림', icon: IconBell, badge: 'disclosures' },
    ],
  },
  {
    section: '분석',
    items: [
      { href: '/report', label: '리포트', icon: IconFileAnalytics },
      { href: '/portfolio', label: '포트폴리오', icon: IconChartPie },
      { href: '/qa', label: 'Q&A', icon: IconMessage2 },
    ],
  },
  {
    section: '설정',
    items: [
      { href: '/settings', label: '설정', icon: IconSettings },
    ],
  },
]

export default function Sidebar() {
  const pathname = usePathname()
  const router = useRouter()

  async function handleLogout() {
    await fetch('/api/auth/logout', { method: 'POST' })
    router.replace('/login')
    router.refresh()
  }

  return (
    <aside style={{ background: 'var(--color-navy)', display: 'flex', flexDirection: 'column', width: 200, minHeight: '100vh' }}>
      {/* Logo */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '18px 16px 14px', borderBottom: '0.5px solid #1A2235' }}>
        <svg width="22" height="22" viewBox="0 0 30 30" fill="none">
          <path d="M4 22 L15 7 L26 22" stroke="#3B8BFF" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/>
          <path d="M8 18 L22 18" stroke="#3B8BFF" strokeWidth="1.6" strokeLinecap="round" opacity="0.4"/>
          <circle cx="15" cy="7" r="2.2" fill="#E24B4A"/>
        </svg>
        <div>
          <span className="font-display" style={{ fontSize: 22, color: '#E8F4FF', lineHeight: 1 }}>
            공시리<span style={{ color: '#3B8BFF' }}>.</span>
          </span>
          <span style={{ fontSize: 9, letterSpacing: '0.08em', color: '#444441', marginLeft: 2, verticalAlign: 'middle' }}>DISCLOSURE AI</span>
        </div>
      </div>

      {/* Nav */}
      <nav style={{ padding: '12px 10px', flex: 1 }}>
        {NAV.map(({ section, items }) => (
          <div key={section}>
            <p style={{ fontSize: 9.5, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#3B4A63', padding: '0 8px', margin: '14px 0 6px' }}>
              {section}
            </p>
            {items.map(({ href, label, icon: Icon }) => {
              const active = pathname === href || pathname.startsWith(href + '/')
              return (
                <Link key={href} href={href} style={{ textDecoration: 'none' }}>
                  <div style={{
                    display: 'flex', alignItems: 'center', gap: 9,
                    padding: '7px 10px', borderRadius: 7, marginBottom: 1,
                    background: active ? '#1A2235' : 'transparent',
                    cursor: 'pointer',
                  }}>
                    <Icon size={15} color={active ? '#3B8BFF' : '#5F5E5A'} />
                    <span style={{ fontSize: 13, letterSpacing: '-0.03em', color: active ? '#E8F4FF' : '#888780', fontWeight: active ? 500 : 400 }}>
                      {label}
                    </span>
                  </div>
                </Link>
              )
            })}
          </div>
        ))}
      </nav>

      {/* User */}
      <div style={{ padding: '12px 10px', borderTop: '0.5px solid #1A2235' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px' }}>
          <div style={{ width: 28, height: 28, borderRadius: '50%', background: '#1A2235', border: '0.5px solid #2A3A52', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 500, color: '#B5D4F4' }}>
            공
          </div>
          <div style={{ minWidth: 0 }}>
            <p style={{ fontSize: 12, color: '#E8F4FF', letterSpacing: '-0.02em' }}>공시리 관리자</p>
            <p style={{ fontSize: 10, color: '#5F5E5A', letterSpacing: '-0.01em' }}>dev session</p>
          </div>
          <button
            type="button"
            onClick={handleLogout}
            aria-label="로그아웃"
            style={{ marginLeft: 'auto', background: 'transparent', border: 0, color: '#5F5E5A', cursor: 'pointer', display: 'flex', padding: 4 }}
          >
            <IconLogout size={14} />
          </button>
        </div>
      </div>
    </aside>
  )
}
