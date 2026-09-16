import test from 'node:test'
import assert from 'node:assert/strict'

import { attachLocalPlayerEntity } from './player-entity.js'
import { createDungeonNetworkRuntime } from './network-runtime.js'

function state(x = 0, overrides = {}) {
  return {
    x,
    y: 20,
    hp: 100,
    maxHp: 100,
    damage: 10,
    critChance: 0,
    equipment: { weapon: null },
    modifiers: {},
    ...overrides,
  }
}

function sceneFixture() {
  const scene = {
    floor: 1,
    kills: 0,
    floorKills: 0,
    floorCleared: false,
    runComplete: false,
    portal: null,
    drops: [],
    players: new Map(),
    enemies: [],
    time: { now: 1000 },
    makeActor(x, y) {
      return {
        x,
        y,
        setDepth() { return this },
        setPosition(nextX, nextY) { this.x = nextX; this.y = nextY; return this },
        destroy() {},
      }
    },
    createHealthBar() { return { destroy() {} } },
    updateHealthBar() {},
    syncPlayerAnimation() {},
    emitStats() {},
  }
  attachLocalPlayerEntity(scene, { id: 'host', state: state(10) })
  return scene
}

function socketFixture() {
  return {
    async request() { return { ok: true } },
    subscribe() { return () => {} },
  }
}

function roomMessage(payload) {
  return { data: { topicId: 'room:ABC123', message: payload } }
}

test('authority accepts full state only for unknown peer bootstrap then treats live snapshots as movement-only', () => {
  const scene = sceneFixture()
  const runtime = createDungeonNetworkRuntime({
    socket: socketFixture(),
    scene,
    roomId: 'ABC123',
    localPlayerId: 'host',
    hostId: 'host',
    now: () => 5000,
  })

  runtime.handleMessage(roomMessage({
    type: 'dungeon.snapshot',
    playerId: 'guest',
    snapshot: {
      id: 'guest',
      state: state(100, {
        hp: 90,
        equipment: { weapon: { id: 'bootstrap-blade', damage: 12 } },
      }),
      facing: 'left',
      moving: false,
      dead: false,
      lastAttackAt: 100,
      skillCooldowns: { primary: 200 },
    },
  }))

  const guest = scene.players.get('guest')
  assert.equal(guest.state.hp, 90)
  assert.equal(guest.state.equipment.weapon.id, 'bootstrap-blade')

  guest.state.hp = 45
  guest.state.equipment.weapon = { id: 'authority-blade', damage: 44 }
  guest.lastAttackAt = 5000
  guest.runtime.skills.cooldowns.primary = 8000
  guest.dead = false

  runtime.handleMessage(roomMessage({
    type: 'dungeon.snapshot',
    playerId: 'guest',
    snapshot: {
      id: 'guest',
      state: state(180, {
        y: 220,
        hp: 100,
        equipment: { weapon: { id: 'stale-client-blade', damage: 1 } },
      }),
      facing: 'right',
      moving: true,
      attacking: true,
      dead: true,
      lastAttackAt: 999999,
      skillCooldowns: { primary: 999999 },
    },
  }))

  assert.equal(scene.players.get('guest'), guest)
  assert.equal(guest.state.x, 180)
  assert.equal(guest.state.y, 220)
  assert.equal(guest.actor.x, 180)
  assert.equal(guest.actor.y, 220)
  assert.equal(guest.facing, 'right')
  assert.equal(guest.moving, true)
  assert.equal(guest.attacking, true)

  assert.equal(guest.state.hp, 45)
  assert.equal(guest.state.equipment.weapon.id, 'authority-blade')
  assert.equal(guest.lastAttackAt, 5000)
  assert.equal(guest.runtime.skills.cooldowns.primary, 8000)
  assert.equal(guest.dead, false)
})
