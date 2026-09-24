import test from 'node:test'
import assert from 'node:assert/strict'

import { shouldApplyXiangqiSnapshot } from './client-state.js'

test('xiangqi snapshots never move an active board backwards', () => {
  assert.equal(shouldApplyXiangqiSnapshot({ status: 'playing', ply: 8 }, { status: 'playing', ply: 7 }), false)
  assert.equal(shouldApplyXiangqiSnapshot({ status: 'playing', ply: 8 }, { status: 'playing', ply: 8 }), true)
  assert.equal(shouldApplyXiangqiSnapshot({ status: 'playing', ply: 8 }, { status: 'playing', ply: 9 }), true)
  assert.equal(shouldApplyXiangqiSnapshot(null, { status: 'playing', ply: 0 }), true)
})

test('xiangqi rematch may reset ply to zero', () => {
  assert.equal(
    shouldApplyXiangqiSnapshot(
      { status: 'finished', ply: 42 },
      { status: 'playing', ply: 0 },
    ),
    true,
  )
})
