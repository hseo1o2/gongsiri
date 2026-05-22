export const DEV_SESSION_COOKIE = 'gongsiri_dev_session'
export const DEV_SESSION_MAX_AGE_SECONDS = 8 * 60 * 60

export function isDevSessionCookieValue(value: string | undefined): boolean {
  return typeof value === 'string' && value.startsWith('dev-session:')
}

export function getBackendBaseUrl(): string {
  const baseUrl = process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:8000'
  return baseUrl.endsWith('/') ? baseUrl.slice(0, -1) : baseUrl
}
