import test from 'node:test'
import assert from 'node:assert/strict'
import { replay } from './replay.js'

test('police thief replay preserves path state and final capture', () => {
  let now = 0
  const recorder = replay.createRecorder({ now: () => now })
  recorder.record({ thief: 'C', police: 'B', turn: 'thief', moves: 0, status: 'playing' })
  now = 2_000
  recorder.record({ thief: 'F', police: 'B', turn: 'police', moves: 1, status: 'playing', last: { role: 'thief', from: 'C', to: 'F' } })
  now = 4_000
  recorder.record({ thief: 'F', police: 'F', turn: 'police', winner: 'police', moves: 2, status: 'finished', last: { role: 'police', from: 'D', to: 'F' } })

  const decoded = replay.decode(replay.encode(recorder.snapshot()))
  assert.equal(decoded.frames.at(-1).state.police, 'F')
  assert.equal(decoded.frames.at(-1).state.winner, 'police')
  assert.deepEqual(decoded.frames.at(-1).state.last, { role: 'police', from: 'D', to: 'F' })
})
