import test from 'node:test'
import assert from 'node:assert/strict'
import { replay } from './replay.js'

function board(stones = []) {
  const value = Array.from({ length: 15 }, () => Array(15).fill(0))
  for (const [x, y, color] of stones) value[y][x] = color
  return value
}

test('gomoku replay keeps latest rolling states and codec preserves final board', () => {
  let now = 0
  const recorder = replay.createRecorder({ now: () => now })
  recorder.record({ board: board([[7,7,1]]), moves: 1, status: 'playing' })
  now = 5_000
  recorder.record({ board: board([[7,7,1],[8,8,2]]), moves: 2, status: 'playing' })
  now = 21_000
  recorder.record({ board: board([[7,7,1],[8,8,2],[8,7,1]]), moves: 3, status: 'playing' })

  const recording = recorder.snapshot()
  assert.equal(recording.frames.length, 2)
  const decoded = replay.decode(replay.encode(recording))
  assert.equal(decoded.frames.at(-1).state.moves, 3)
  assert.equal(decoded.frames.at(-1).state.board[7][8], 1)
})
