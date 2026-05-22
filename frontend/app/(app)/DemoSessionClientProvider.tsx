'use client'

import { DemoSessionProvider } from '@/lib/demo-session'
import type { ReactNode } from 'react'

export default function DemoSessionClientProvider({ children }: { children: ReactNode }) {
  return <DemoSessionProvider>{children}</DemoSessionProvider>
}
