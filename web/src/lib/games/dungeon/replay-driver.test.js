import test from 'node:test'
import assert from 'node:assert/strict'
import { createDungeonReplayDriver, eventsBetween, stateAt } from './replay-driver.js'

const recording = {
  version: 3,
  durationMs: 1_000,
  frames: [
    { t: 0, state: { scene: { floor: 1 }, players: [{ id: 'p1', x: 0, y: 10, hp: 100 }], enemies: [{ id: 'e1', x: 100, y: 0, hp: 20 }], drops: [], projectiles: [] } },
    { t: 1_000, state: { scene: { floor: 1 }, players: [{ id: 'p1', x: 100, y: 30, hp: 50 }], enemies: [{ id: 'e1', x: 50, y: 100, hp: 10 }, { id: 'e2', x: 90, y: 90, hp: 10 }], drops: [], projectiles: [] } },
  ],
  events: [
    { t: 200, seq: 0, type: 'player.attack', playerId: 'p1' },
    { t: 200, seq: 1, type: 'hit', targetId: 'e1' },
    { t: 700, seq: 2, type: 'death', entityId: 'e1' },
  ],
}

test('stateAt interpolates only matching entity positions and keeps discrete state from previous frame', () => {
  const state = stateAt(recording, 500)
  assert.equal(state.players[0].x, 50)
  assert.equal(state.players[0].y, 20)
  assert.equal(state.players[0].hp, 100)
  assert.equal(state.enemies[0].x, 75)
  assert.equal(state.enemies[0].y, 50)
  assert.equal(state.enemies.length, 1)
})

test('eventsBetween preserves timestamp and seq ordering without duplication', () => {
  assert.deepEqual(eventsBetween(recording, 0, 200).map((event) => event.type), ['player.attack', 'hit'])
  assert.deepEqual(eventsBetween(recording, 200, 900).map((event) => event.type), ['death'])
})

test('seek resets transient presentation, applies state, then replays semantic events from base frame', () => {
  const calls = []
  const scene = {
    resetReplayTransient() { calls.push(['reset']) },
    applyReplayState(state) { calls.push(['state', state.players[0].x]) },
    presentEvent(event) { calls.push(['event', event.type]) },
  }
  const driver = createDungeonReplayDriver({ recording, scene, loop: false, now: () => 0, requestFrame: () => 1, cancelFrame: () => {} })
  driver.seek(750)
  assert.deepEqual(calls, [
    ['reset'],
    ['state', 75],
    ['event', 'player.attack'],
    ['event', 'hit'],
    ['event', 'death'],
  ])
})

test('sequential playback dispatches each event once', () => {
  const events = []
  let current = 0
  let callback = null
  const scene = {
    applyReplayState() {},
    presentEvent(event) { events.push(event.type) },
    resetReplayTransient() {},
  }
  const driver = createDungeonReplayDriver({
    recording,
    scene,
    loop: false,
    now: () => current,
    requestFrame(fn) { callback = fn; return 1 },
    cancelFrame() {},
  })
  driver.play()
  current = 250
  callback()
  current = 800
  callback()
  current = 900
  callback()
  assert.deepEqual(events, ['player.attack', 'hit', 'death'])
})
