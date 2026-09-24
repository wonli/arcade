import test from 'node:test'
import assert from 'node:assert/strict'
import { replay } from './replay.js'

function board(piece = 0) {
  const value = Array.from({ length: 10 }, () => Array(9).fill(0))
  if (piece) value[4][4] = piece
  return value
}

test('xiangqi replay preserves latest position and visible game facts', () => {
  let now = 0
  const recorder = replay.createRecorder({ now: () => now })
  recorder.record({ board: board(1), ply: 1, turn: 'black', status: 'playing' })
  now = 21_000
  recorder.record({
    board: board(-7),
    ply: 12,
    turn: 'red',
    check: true,
    status: 'finished',
    winner: 'red',
    drawReason: 'timeout',
    last: { from: { x: 4, y: 1 }, to: { x: 4, y: 4 } },
    legalMoves: [{ from: { x: 0, y: 0 }, to: { x: 0, y: 1 } }],
  })

  const decoded = replay.decode(replay.encode(recorder.snapshot()))
  assert.equal(decoded.frames.length, 1)
  const state = decoded.frames[0].state
  assert.equal(state.ply, 12)
  assert.equal(state.board[4][4], -7)
  assert.equal(state.check, true)
  assert.equal(state.status, 'finished')
  assert.equal(state.winner, 'red')
  assert.equal(state.drawReason, 'timeout')
  assert.deepEqual(state.last, { from: { x: 4, y: 1 }, to: { x: 4, y: 4 } })
  assert.equal('legalMoves' in state, false)
})

test('xiangqi replay rejects malformed board shapes', () => {
  const recorder = replay.createRecorder()
  assert.equal(recorder.record({ board: Array.from({ length: 9 }, () => Array(9).fill(0)) }), false)
  assert.equal(recorder.record({ board: Array.from({ length: 10 }, () => Array(8).fill(0)) }), false)
})
