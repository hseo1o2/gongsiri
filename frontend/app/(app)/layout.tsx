import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import Sidebar from '@/components/layout/Sidebar'
import AgentStatusBar from '@/components/layout/AgentStatusBar'
import DemoSessionClientProvider from './DemoSessionClientProvider'
import type { ReactNode } from 'react'
import { DEV_SESSION_COOKIE, isDevSessionCookieValue } from '@/lib/auth/dev-session'

export default async function AppLayout({ children }: { children: ReactNode }) {
  const sessionCookie = (await cookies()).get(DEV_SESSION_COOKIE)?.value
  if (!isDevSessionCookieValue(sessionCookie)) {
    redirect('/login')
  }

  return (
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden' }}>
      <Sidebar />
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        <DemoSessionClientProvider>
          <AgentStatusBar />
          <main style={{ flex: 1, overflowY: 'auto', background: 'var(--color-bg-secondary)' }}>
            {children}
          </main>
        </DemoSessionClientProvider>
      </div>
    </div>
  )
}
