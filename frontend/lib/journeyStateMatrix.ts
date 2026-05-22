export const JOURNEY_HAPPY_PATH = [
  '/login',
  '/dashboard',
  '/watchlist',
  '/report',
  '/report/[corpCode]',
  '/qa',
] as const

export interface JourneyStateEntry {
  route: string
  owner: 'auth' | 'dashboard' | 'watchlist' | 'report' | 'qa'
  states: Array<
    | 'loading'
    | 'empty'
    | 'error'
    | 'stale'
    | 'saved'
    | 'generated'
    | 'auth-required'
    | 'dev-shell'
  >
  smokeCheck: string
  firstPersonCopy: string[]
}

export const JOURNEY_STATE_MATRIX: JourneyStateEntry[] = [
  {
    route: '/login',
    owner: 'auth',
    states: ['dev-shell', 'loading', 'error'],
    smokeCheck: 'admin/admin 로그인 -> /dashboard 이동 또는 공시리 오류 배너 확인',
    firstPersonCopy: ['공시리가 확인 중...', '저 공시리가 로그인 상태를 확인하지 못했습니다.'],
  },
  {
    route: '/dashboard',
    owner: 'dashboard',
    states: ['auth-required', 'loading', 'error', 'empty', 'saved', 'stale'],
    smokeCheck: '로그인 후 watchlist/disclosure 카드의 loading/error/empty/ready 상태 확인',
    firstPersonCopy: ['저 공시리가 대시보드 데이터를 불러오지 못했습니다.'],
  },
  {
    route: '/watchlist',
    owner: 'watchlist',
    states: ['loading', 'error', 'empty', 'saved'],
    smokeCheck: 'watchlist 추가/삭제 후 empty/saved와 오류 배너 확인',
    firstPersonCopy: ['저 공시리가 워치리스트를 저장하지 못했습니다.', '저 공시리가 워치리스트를 삭제하지 못했습니다.'],
  },
  {
    route: '/report',
    owner: 'report',
    states: ['empty', 'error', 'saved', 'stale'],
    smokeCheck: 'report list empty/error/saved summary 상태와 stale cache 설명 확인',
    firstPersonCopy: ['저 공시리가 리포트 목록을 불러오지 못했습니다.'],
  },
  {
    route: '/report/[corpCode]',
    owner: 'report',
    states: ['error', 'generated', 'saved', 'stale'],
    smokeCheck: 'report detail error/generated/saved/stale 상태와 재분석 버튼 흐름 확인',
    firstPersonCopy: ['저 공시리가 리포트 상세를 불러오지 못했습니다.'],
  },
  {
    route: '/qa',
    owner: 'qa',
    states: ['loading', 'empty', 'error', 'saved', 'stale'],
    smokeCheck: 'Q&A 현재 답변 + 최근 저장 이력 + loading/error/empty/stale 상태 확인',
    firstPersonCopy: [
      '공시리가 최근 질문 이력을 불러오는 중입니다...',
      '공시리가 답변을 준비하고 있습니다...',
      '저 공시리가 답변을 가져오지 못했습니다.',
      '저 공시리가 Q&A 이력을 불러오지 못했습니다.',
    ],
  },
]
