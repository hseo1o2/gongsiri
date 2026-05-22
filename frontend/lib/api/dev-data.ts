import type { DisclosureAlert, WatchlistItem } from '@/lib/types'

export interface DashboardSummaryContract {
  count: number
  todayDisclosures: number
  cautionCount: number
  dangerCount: number
}

export interface DashboardSnapshotContract {
  ok: true
  userId: string
  watchlist: WatchlistItem[]
  recentDisclosures: DisclosureAlert[]
  summary: DashboardSummaryContract
}

export interface WatchlistResponseContract {
  ok: true
  items: WatchlistItem[]
}

export interface WatchlistMutationResponseContract {
  ok: true
  item: WatchlistItem
}

export interface DisclosuresResponseContract {
  ok: true
  items: DisclosureAlert[]
}

export function isFailureEnvelope(value: unknown): value is { error?: { message?: string }; message?: string } {
  return typeof value === 'object' && value !== null
}

export async function fetchDashboardSnapshot(): Promise<DashboardSnapshotContract> {
  const response = await fetch('/api/dashboard', { cache: 'no-store' })
  const payload = await response.json()
  if (!response.ok || payload?.ok !== true) {
    throw new Error(resolveApiMessage(payload, '대시보드 데이터를 불러올 수 없습니다.'))
  }
  return payload as DashboardSnapshotContract
}

export async function fetchRecentDisclosures(): Promise<DisclosureAlert[]> {
  const response = await fetch('/api/disclosures/recent', { cache: 'no-store' })
  const payload = await response.json()
  if (!response.ok || payload?.ok !== true || !Array.isArray(payload.items)) {
    throw new Error(resolveApiMessage(payload, '최근 공시를 불러올 수 없습니다.'))
  }
  return (payload as DisclosuresResponseContract).items
}

export async function addWatchlistItem(item: WatchlistItem): Promise<WatchlistItem> {
  const response = await fetch('/api/watchlist', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(item),
  })
  const payload = await response.json()
  if (!response.ok || payload?.ok !== true) {
    throw new Error(resolveApiMessage(payload, '워치리스트에 추가하지 못했습니다.'))
  }
  return (payload as WatchlistMutationResponseContract).item
}

export async function deleteWatchlistItem(corpCode: string): Promise<void> {
  const response = await fetch(`/api/watchlist?corp_code=${encodeURIComponent(corpCode)}`, {
    method: 'DELETE',
  })
  const payload = await response.json()
  if (!response.ok || payload?.ok !== true) {
    throw new Error(resolveApiMessage(payload, '워치리스트에서 삭제하지 못했습니다.'))
  }
}

function resolveApiMessage(payload: unknown, fallback: string): string {
  if (isFailureEnvelope(payload)) {
    return payload.error?.message ?? payload.message ?? fallback
  }
  return fallback
}
