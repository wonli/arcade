import test from 'node:test'
import assert from 'node:assert/strict'
import { replay } from './replay.js'

test('dungeon replay keeps compact visible scene facts only', () => {
  let now = 0
  const recorder = replay.createRecorder({ now: () => now })
  recorder.record({
    player: { x: 120, y: 220 },
    enemies: [{ x: 400, y: 280, kind: 'elite' }],
    stats: { hp: 72, maxHp: 100, kills: 12 },
    progress: { floor: 3, room: 4, roomRole: 'combat' },
    internalRuntime: { giant: 'must-not-leak' },
  })
  const bytes = replay.encode(recorder.snapshot())
  const text = new TextDecoder().decode(bytes)
  assert.equal(text.includes('must-not-leak'), false)
  const decoded = replay.decode(bytes)
  assert.equal(decoded.frames[0].state.progress.floor, 3)
  assert.equal(decoded.frames[0].state.enemies.length, 1)
})
