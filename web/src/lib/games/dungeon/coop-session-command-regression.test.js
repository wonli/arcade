import test from 'node:test'
import assert from 'node:assert/strict'

import { ensureDungeonLootRuntime } from './loot-runtime.js'
import { attachLocalPlayerEntity, attachPlayerEntity } from './player-entity.js'
import { executePlayerCommand } from './player-command-runtime.js'
import { createDungeonNetworkRuntime } from './network-runtime.js'

function state(x = 0) {
  return {
    x,
    y: 20,
    hp: 100,
    maxHp: 100,
    damage: 10,
    critChance: 0,
    healthPotions: 0,
    equipment: { weapon: null },
    modifiers: {},
  }
}

function sceneFixture(localId = 'host') {
  const scene = {
    floor: 1,
    kills: 0,
    floorKills: 0,
    floorCleared: false,
    runComplete: false,
    portal: null,
    drops: [],
    enemies: [],
    players: new Map(),
    time: { now: 1000 },
    makeActor(x, y) {
      return {
        x, y,
        setDepth() { return this },
        setPosition(nextX, nextY) { this.x = nextX; this.y = nextY; return this },
        destroy() { this.destroyed = true },
      }
    },
    createHealthBar() { return { destroy() { this.destroyed = true } } },
    updateHealthBar() {},
    syncPlayerAnimation() {},
    emitStats() {},
  }
  const local = attachLocalPlayerEntity(scene, { id: localId, state: state(10) })
  local.actor = scene.makeActor(local.state.x, local.state.y)
  local.bar = scene.createHealthBar()
  return scene
}

function socketFixture() {
  const calls = []
  const listeners = new Map()
  return {
    calls,
    listeners,
    async request(action, params) {
      calls.push({ action, params })
      return { ok: true }
    },
    subscribe(topic, listener) {
      listeners.set(topic, listener)
      return () => listeners.delete(topic)
    },
  }
}

function roomMessage(payload) {
  return { data: { topicId: 'room:ABC123', message: payload } }
}

function floorTwoCheckpoint() {
  return {
    version: 1,
    roomId: 'ABC123',
    runSeed: 'ABC123',
    authority: { epoch: 1, authorityId: 'host', sequence: 8 },
    status: 'playing',
    world: {
      type: 'world.state',
      floor: 2,
      kills: 4,
      floorKills: 0,
      floorCleared: false,
      runComplete: false,
      enemies: [],
      drops: [],
      portal: null,
    },
    players: {
      host: { id: 'host', state: state(120) },
      guest: { id: 'guest', state: state(180) },
    },
    lifecycle: {
      host: { status: 'alive', respawnRemainingMs: 0, invulnerabilityRemainingMs: 0 },
      guest: { status: 'alive', respawnRemainingMs: 0, invulnerabilityRemainingMs: 0 },
    },
    openedChestIds: [],
  }
}

test('hydrating follower retries checkpoint sync until authority answers', async () => {
  const scene = sceneFixture('guest')
  const socket = socketFixture()
  let tick = null
  const runtime = createDungeonNetworkRuntime({
    socket,
    scene,
    roomId: 'ABC123',
    localPlayerId: 'guest',
    hostId: 'host',
    setIntervalImpl(callback) { tick = callback; return 1 },
    clearIntervalImpl() {},
  })

  runtime.start()
  await Promise.resolve()
  assert.equal(socket.calls.filter((call) => call.action === 'dungeon.snapshot' && call.params.snapshot.syncCheckpoint === true).length, 1)

  tick?.()
  await Promise.resolve()

  assert.equal(socket.calls.filter((call) => call.action === 'dungeon.snapshot' && call.params.snapshot.syncCheckpoint === true).length, 2)
  runtime.stop()
})

test('open_chest binds spatial authority even when LootRuntime already exists', () => {
  const scene = sceneFixture('host')
  const guest = attachPlayerEntity(scene, { id: 'guest', state: state(40) })
  ensureDungeonLootRuntime(scene)
  let opened = null
  scene.__dungeonSpatial = {
    openChestById(player, chestId) {
      opened = { player, chestId }
      return { opened: true, chestId }
    },
  }

  const result = executePlayerCommand(scene, {
    type: 'open_chest',
    playerId: 'guest',
    chestId: 'floor-1:chest-0',
  })

  assert.equal(result.applied, true)
  assert.deepEqual(opened, { player: guest, chestId: 'floor-1:chest-0' })
})

test('refreshing host accepts follower-carried canonical checkpoint before keeping fresh floor one', () => {
  const scene = sceneFixture('host')
  const socket = socketFixture()
  const runtime = createDungeonNetworkRuntime({
    socket,
    scene,
    roomId: 'ABC123',
    localPlayerId: 'host',
    hostId: 'host',
    setIntervalImpl: () => 1,
    clearIntervalImpl() {},
  })

  runtime.start()
  assert.equal(scene.floor, 1)

  runtime.handleMessage(roomMessage({
    type: 'dungeon.snapshot',
    playerId: 'guest',
    snapshot: {
      id: 'guest',
      state: state(180),
      recoveryCheckpoint: floorTwoCheckpoint(),
    },
  }))

  assert.equal(scene.floor, 2)
  assert.equal(runtime.checkpoint()?.world?.floor, 2)
  runtime.stop()
})
