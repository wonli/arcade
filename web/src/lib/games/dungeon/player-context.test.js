import assert from 'node:assert/strict'
import test from 'node:test'

import {
  applyPlayerContextSnapshot,
  createPlayerContext,
  mergeDungeonInput,
  normalizeDungeonInput,
  snapshotPlayerContext,
} from './player-context.js'

test('normalizeDungeonInput clamps movement vector and strips position authority', () => {
  const input = normalizeDungeonInput({ seq: 7.9, moveX: 3, moveY: 4, x: 999, y: 999, skill: 1 })
  assert.equal(input.seq, 7)
  assert.equal(Math.round(Math.hypot(input.moveX, input.moveY) * 1000), 1000)
  assert.equal(input.moveX, 0.6)
  assert.equal(input.moveY, 0.8)
  assert.equal(input.skill, true)
  assert.equal('x' in input, false)
  assert.equal('y' in input, false)
})

test('mergeDungeonInput combines keyboard and touch intent without exceeding unit length', () => {
  const input = mergeDungeonInput(
    { moveX: 1, moveY: 0, skill: false },
    { moveX: 0.8, moveY: -0.8, interact: true },
  )
  assert.ok(Math.hypot(input.moveX, input.moveY) <= 1.000001)
  assert.equal(input.skill, false)
  assert.equal(input.interact, true)
})

test('player context snapshots contain gameplay state but not actor objects', () => {
  const actor = { destroy() {} }
  const player = createPlayerContext({
    id: 'p2',
    state: { x: 12, y: 34, hp: 80, effects: { chain: 0.2 } },
    actor,
    facing: 'left',
    moving: true,
  })
  const snapshot = snapshotPlayerContext(player)
  assert.deepEqual(snapshot.state, { x: 12, y: 34, hp: 80, effects: { chain: 0.2 } })
  assert.equal(snapshot.facing, 'left')
  assert.equal(snapshot.moving, true)
  assert.equal('actor' in snapshot, false)
  snapshot.state.effects.chain = 1
  assert.equal(player.state.effects.chain, 0.2)
})

test('applyPlayerContextSnapshot can preserve predicted position while reconciling stats', () => {
  const player = createPlayerContext({ id: 'guest', state: { x: 50, y: 60, hp: 100, damage: 10 } })
  applyPlayerContextSnapshot(player, {
    state: { x: 80, y: 90, hp: 72, damage: 17 },
    facing: 'up',
    moving: true,
  }, { preservePosition: true })
  assert.deepEqual(player.state, { x: 50, y: 60, hp: 72, damage: 17 })
  assert.equal(player.facing, 'up')
})
