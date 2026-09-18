import test from 'node:test'
import assert from 'node:assert/strict'
import { replay } from './replay.js'

function state(tick, x) {
  return { tick, food: { x: 9, y: 4 }, snakes: [{ playerId: 'p1', alive: true, score: tick, body: [{ x, y: 5 }, { x: x - 1, y: 5 }] }] }
}

test('snake replay rate-limits arena snapshots and preserves visible state', () => {
  let now = 0
  const recorder = replay.createRecorder({ now: () => now })
  assert.equal(recorder.record(state(1, 4)), true)
  now = 50
  assert.equal(recorder.record(state(2, 5)), false)
  now = 160
  assert.equal(recorder.record(state(3, 6)), true)

  const decoded = replay.decode(replay.encode(recorder.snapshot()))
  assert.equal(decoded.frames.length, 2)
  assert.equal(decoded.frames.at(-1).state.tick, 3)
  assert.equal(decoded.frames.at(-1).state.snakes[0].body[0].x, 6)
})
