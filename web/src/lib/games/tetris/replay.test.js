import test from 'node:test'
import assert from 'node:assert/strict'
import { replay } from './replay.js'

function board(value = 0) {
  const rows = Array.from({ length: 20 }, () => Array(10).fill(0))
  if (value) rows[19][4] = value
  return rows
}

test('tetris replay rate-limits snapshots and preserves board score and opponent', () => {
  let now = 0
  const recorder = replay.createRecorder({ now: () => now })
  assert.equal(recorder.record({ board: board(1), score: 10, lines: 0 }), true)
  now = 50
  assert.equal(recorder.record({ board: board(2), score: 20, lines: 0 }), false)
  now = 180
  assert.equal(recorder.record({ board: board(3), score: 40, lines: 1, opponent: { board: board(4), score: 30, lines: 0 } }), true)

  const decoded = replay.decode(replay.encode(recorder.snapshot()))
  assert.equal(decoded.frames.length, 2)
  assert.equal(decoded.frames.at(-1).state.score, 40)
  assert.equal(decoded.frames.at(-1).state.board[19][4], 3)
  assert.equal(decoded.frames.at(-1).state.opponent.board[19][4], 4)
})
