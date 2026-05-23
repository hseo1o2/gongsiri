export const DEV_SESSION_COOKIE = 'gongsiri_dev_session'
export const DEV_SESSION_MAX_AGE_SECONDS = 8 * 60 * 60

/**
 * 세션 쿠키 공통 속성. 발급(login)과 만료(logout)가 동일한 속성을 써야
 * 브라우저가 같은 쿠키로 인식해 안정적으로 갱신·삭제된다.
 * secure는 프로덕션(HTTPS)에서만 켠다 — dev(HTTP)에서는 켜면 쿠키가 설정되지 않는다.
 */
export const DEV_SESSION_COOKIE_OPTIONS = {
  httpOnly: true,
  sameSite: 'lax' as const,
  secure: process.env.NODE_ENV === 'production',
  path: '/',
}

export function isDevSessionCookieValue(value: string | undefined): boolean {
  return typeof value === 'string' && value.startsWith('dev-session:')
}

export function getBackendBaseUrl(): string {
  const baseUrl = process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:8000'
  return baseUrl.endsWith('/') ? baseUrl.slice(0, -1) : baseUrl
}
