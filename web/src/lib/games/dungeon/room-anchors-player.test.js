import test from 'node:test'
import assert from 'node:assert/strict'

import { createPlayerEntity } from './player-entity.js'
import { placePlayerAtRoomSpawn } from './room-anchors.js'

function actor() {
  return {
    x: 0,
    y: 0,
    setPosition(x, y) {
      this.x = x
      this.y = y
      return this
    },
  }
}

test('room spawn placement only mutates the provided PlayerEntity', () => {
  const local = createPlayerEntity({
    id: 'local',
    state: { x: 10, y: 20, hp: 80, maxHp: 100 },
    actor: actor(),
    bar: { id: 'local-bar' },
  })
  const target = createPlayerEntity({
    id: 'target',
    state: { x: 30, y: 40, hp: 60, maxHp: 90 },
    actor: actor(),
    bar: { id: 'target-bar' },
  })
  const healthUpdates = []
  const scene = {
    localPlayer: local,
    __roomGeometry: { spawn: { x: 222, y: 333 } },
    updateHealthBar(...args) { healthUpdates.push(args) },
  }

  placePlayerAtRoomSpawn(scene, target)

  assert.deepEqual({ x: target.state.x, y: target.state.y }, { x: 222, y: 333 })
  assert.deepEqual({ x: target.actor.x, y: target.actor.y }, { x: 222, y: 333 })
  assert.deepEqual({ x: local.state.x, y: local.state.y }, { x: 10, y: 20 })
  assert.deepEqual({ x: local.actor.x, y: local.actor.y }, { x: 0, y: 0 })
  assert.deepEqual(healthUpdates, [[target.bar, 222, 291, 60, 90]])
})
