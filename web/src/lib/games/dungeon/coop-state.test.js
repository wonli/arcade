import assert from 'node:assert/strict'
import test from 'node:test'

import { createPlayerContext } from './player-context.js'
import {
  createDungeonCoopSnapshot,
  dungeonRoomRole,
  geometrySignature,
  reconcilePredictedPlayer,
  shouldIncludeGeometry,
} from './coop-state.js'

test('dungeonRoomRole identifies host and guest from the shared room model', () => {
  const room = { hostId: 'p1', players: [{ id: 'p1' }, { id: 'p2' }] }
  assert.equal(dungeonRoomRole(room, 'p1'), 'host')
  assert.equal(dungeonRoomRole(room, 'p2'), 'guest')
  assert.equal(dungeonRoomRole(room, 'p3'), 'spectator')
})

test('co-op snapshot strips Phaser objects and includes both player contexts', () => {
  const p1 = createPlayerContext({ id: 'p1', state: { x: 10, y: 20, hp: 100 }, actor: { destroy() {} } })
  const p2 = createPlayerContext({ id: 'p2', state: { x: 30, y: 40, hp: 80 }, actor: { destroy() {} } })
  const scene = {
    floor: 3,
    enemies: [{ id: 'e1', x: 5, y: 6, hp: 10, maxHp: 10, visual: { setPosition() {} } }],
    drops: [],
    __dungeonPlayerRuntime: { activePlayers: () => [p1, p2] },
    __dungeonSpatial: {
      getChests: () => [{ id: 'chest-0', x: 80, y: 96, opened: true, visuals: { sprite: { destroy() {} } } }],
    },
  }
  const snapshot = createDungeonCoopSnapshot(scene, { chapter: 2 }, { sequence: 4 })
  assert.equal(snapshot.players.length, 2)
  assert.equal(snapshot.players[0].state.x, 10)
  assert.equal('actor' in snapshot.players[0], false)
  assert.equal('visual' in snapshot.enemies[0], false)
  assert.deepEqual(snapshot.chests, [{ id: 'chest-0', x: 80, y: 96, opened: true }])
})

test('prediction reconciliation preserves small error but corrects large divergence', () => {
  const player = createPlayerContext({ id: 'p2', state: { x: 100, y: 100, hp: 100 } })
  reconcilePredictedPlayer(player, { state: { x: 112, y: 100, hp: 80 }, facing: 'right' })
  assert.equal(player.state.x, 100)
  assert.equal(player.state.hp, 80)

  reconcilePredictedPlayer(player, { state: { x: 260, y: 100, hp: 70 }, facing: 'right' })
  assert.equal(player.state.x, 260)
  assert.equal(player.state.hp, 70)
})

test('geometry cadence includes initial, changed and periodic snapshots', () => {
  assert.equal(shouldIncludeGeometry(1, 'a', '', 20), true)
  assert.equal(shouldIncludeGeometry(5, 'b', 'a', 20), true)
  assert.equal(shouldIncludeGeometry(20, 'a', 'a', 20), true)
  assert.equal(shouldIncludeGeometry(7, 'a', 'a', 20), false)
  assert.notEqual(geometrySignature({ seed: 1, width: 10, height: 10 }), geometrySignature({ seed: 2, width: 10, height: 10 }))
})
