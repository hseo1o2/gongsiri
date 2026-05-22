import assert from 'node:assert/strict'
import test from 'node:test'
import { JOURNEY_HAPPY_PATH, JOURNEY_STATE_MATRIX } from '../lib/journeyStateMatrix'

test('journey happy path remains auth to dashboard to report to qa', () => {
  assert.deepEqual([...JOURNEY_HAPPY_PATH], [
    '/login',
    '/dashboard',
    '/watchlist',
    '/report',
    '/report/[corpCode]',
    '/qa',
  ])
})

test('state matrix defines required loading/empty/error or saved/generated coverage', () => {
  const routes = Object.fromEntries(JOURNEY_STATE_MATRIX.map(item => [item.route, item.states]))

  assert.deepEqual(routes['/login'], ['dev-shell', 'loading', 'error'])
  assert.deepEqual(routes['/dashboard'], ['auth-required', 'loading', 'error', 'empty', 'saved', 'stale'])
  assert.deepEqual(routes['/watchlist'], ['loading', 'error', 'empty', 'saved'])
  assert.deepEqual(routes['/report'], ['empty', 'error', 'saved', 'stale'])
  assert.deepEqual(routes['/report/[corpCode]'], ['error', 'generated', 'saved', 'stale'])
  assert.deepEqual(routes['/qa'], ['loading', 'empty', 'error', 'saved', 'stale'])
})

test('user-facing failure/loading copy in matrix stays in 공시리 first-person tone', () => {
  for (const entry of JOURNEY_STATE_MATRIX) {
    for (const message of entry.firstPersonCopy) {
      assert.match(message, /(공시리가|저 공시리가)/)
    }
  }
})
