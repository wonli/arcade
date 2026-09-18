import test from 'node:test'
import assert from 'node:assert/strict'
import { replay } from './replay.js'

function board(piece = 0) {
  const value = Array.from({ length: 8 }, () => Array(8).fill(0))
  if (piece) value[4][4] = piece
  return value
}

test('chess replay preserves latest position and visible game facts', () => {
  let now = 0
  const recorder = replay.createRecorder({ now: () => now })
  recorder.record({ board: board(1), ply: 1, turn: 'black', status: 'playing' })
  now = 21_000
  recorder.record({ board: board(-6), ply: 12, turn: 'white', check: true, status: 'playing' })

  const decoded = replay.decode(replay.encode(recorder.snapshot()))
  assert.equal(decoded.frames.length, 1)
  assert.equal(decoded.frames[0].state.ply, 12)
  assert.equal(decoded.frames[0].state.board[4][4], -6)
  assert.equal(decoded.frames[0].state.check, true)
})
