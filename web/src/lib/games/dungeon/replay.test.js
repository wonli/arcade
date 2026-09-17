import test from 'node:test'
import assert from 'node:assert/strict'
import { createDungeonReplaySnapshot, replay } from './replay.js'

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

test('standalone dungeon snapshot normalizes live scene coordinates for replay', () => {
  const scene = {
    localPlayer: { state: { x: 480, y: 300, hp: 64, maxHp: 120 } },
    enemies: [
      { x: 960, y: 0, hp: 20, boss: true },
      { x: 240, y: 150, hp: 0, elite: true },
    ],
    kills: 7,
    floor: 4,
  }
  const snapshot = createDungeonReplaySnapshot({
    scene,
    stats: { hp: 63, maxHp: 120, kills: 8 },
    progress: { floor: 5, room: 2, roomRole: 'boss' },
  })

  assert.deepEqual(snapshot.player, { x: 0.5, y: 0.5 })
  assert.deepEqual(snapshot.enemies[0], { x: 1, y: 0, kind: 'boss', alive: true })
  assert.equal(snapshot.enemies[1].alive, false)
  assert.deepEqual(snapshot.stats, { hp: 63, maxHp: 120, kills: 8 })
  assert.deepEqual(snapshot.progress, { floor: 5, room: 2, roomRole: 'boss' })
})
