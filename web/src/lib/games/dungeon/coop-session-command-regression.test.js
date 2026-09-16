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

function socketFixture({ sessionStates = [] } = {}) {
  const calls = []
  const listeners = new Map()
  const states = [...sessionStates]
  return {
    calls,
    listeners,
    async request(action, params) {
      calls.push({ action, params })
      if (action === 'session.state.get') return { state: states.length ? states.shift() : null }
      return { ok: true }
    },
    subscribe(topic, listener) {
      listeners.set(topic, listener)
      return () => listeners.delete(topic)
    },
  }
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

function storedState(checkpoint = floorTwoCheckpoint()) {
  return {
    authorityId: checkpoint.authority.authorityId,
    authorityEpoch: checkpoint.authority.epoch,
    revision: checkpoint.authority.sequence,
    schemaVersion: checkpoint.version,
    payload: checkpoint,
  }
}

async function nextTurn() {
  await new Promise((resolve) => setImmediate(resolve))
}

test('hydrating follower retries server checkpoint without peer checkpoint snapshots', async () => {
  const scene = sceneFixture('guest')
  const socket = socketFixture({ sessionStates: [null, null] })
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
  await nextTurn()
  assert.equal(socket.calls.filter((call) => call.action === 'session.state.get').length, 1)
  assert.equal(socket.calls.filter((call) => call.action === 'dungeon.snapshot' && call.params.snapshot.syncCheckpoint === true).length, 0)

  tick?.()
  await nextTurn()

  assert.equal(socket.calls.filter((call) => call.action === 'session.state.get').length, 2)
  assert.equal(socket.calls.some((call) => call.action === 'dungeon.snapshot' && call.params.snapshot.recoverCheckpoint === true), false)
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

test('refreshing host restores canonical checkpoint from server memory without peer recovery', async () => {
  const scene = sceneFixture('host')
  const socket = socketFixture({ sessionStates: [storedState()] })
  const errors = []
  const runtime = createDungeonNetworkRuntime({
    socket,
    scene,
    roomId: 'ABC123',
    localPlayerId: 'host',
    hostId: 'host',
    onError(error) { errors.push(error) },
    setIntervalImpl() { return 1 },
    clearIntervalImpl() {},
  })

  runtime.start()
  runtime.updatePeers([{ id: 'host' }, { id: 'guest' }])
  await nextTurn()

  assert.equal(errors.length, 0, errors.map((error) => error?.message ?? String(error)).join('; '))
  assert.equal(runtime.checkpoint()?.world?.floor, 2, 'server checkpoint must enter SessionRuntime before presentation')
  assert.equal(scene.floor, 2, 'server checkpoint presentation must materialize the stored floor')
  assert.equal(socket.calls.filter((call) => call.action === 'session.state.get').length, 1)
  assert.equal(socket.calls.some((call) => call.action === 'dungeon.snapshot' && call.params.snapshot.recoverCheckpoint === true), false)
  runtime.stop()
})

test('authority persists canonical checkpoint to server state transport', async () => {
  const scene = sceneFixture('host')
  const socket = socketFixture({ sessionStates: [null] })
  const runtime = createDungeonNetworkRuntime({
    socket,
    scene,
    roomId: 'ABC123',
    localPlayerId: 'host',
    hostId: 'host',
    setIntervalImpl() { return 1 },
    clearIntervalImpl() {},
  })

  runtime.start()
  await nextTurn()
  await nextTurn()

  const puts = socket.calls.filter((call) => call.action === 'session.state.put')
  assert.equal(puts.length >= 1, true)
  const latest = puts.at(-1).params
  assert.equal(latest.roomId, 'ABC123')
  assert.equal(latest.authorityEpoch, 1)
  assert.equal(latest.schemaVersion, 1)
  assert.equal(latest.revision >= 1, true)
  assert.equal(latest.payload.roomId, 'ABC123')
  runtime.stop()
})
