import test from 'node:test'
import assert from 'node:assert/strict'

import { attachLocalPlayerEntity } from './player-entity.js'
import { createDungeonNetworkRuntime } from './network-runtime.js'

function playerState() {
  return {
    x: 100,
    y: 100,
    hp: 100,
    maxHp: 100,
    equipment: { weapon: null },
    modifiers: {},
  }
}

function sceneFixture() {
  let pickupIntentHandler = null
  const scene = {
    players: new Map(),
    enemies: [],
    drops: [],
    floor: 1,
    time: { now: 1000 },
    __dungeonPickupRuntime: {
      setPickupIntentHandler(next) {
        const previous = pickupIntentHandler
        pickupIntentHandler = typeof next === 'function' ? next : null
        return previous
      },
      getPickupIntentHandler() { return pickupIntentHandler },
    },
  }
  attachLocalPlayerEntity(scene, {
    id: 'guest',
    state: playerState(),
  })
  return scene
}

function storedCheckpoint() {
  const checkpoint = {
    version: 1,
    roomId: 'ABC123',
    runSeed: 'ABC123',
    authority: { epoch: 1, authorityId: 'host', sequence: 1 },
    status: 'playing',
    world: {
      type: 'world.state',
      floor: 1,
      kills: 0,
      floorKills: 0,
      floorCleared: false,
      runComplete: false,
      enemies: [],
      drops: [],
      portal: null,
    },
    players: {
      guest: { id: 'guest', state: playerState() },
    },
    lifecycle: {
      guest: { status: 'alive', respawnRemainingMs: 0, invulnerabilityRemainingMs: 0 },
    },
    openedChestIds: [],
  }
  return {
    authorityId: checkpoint.authority.authorityId,
    authorityEpoch: checkpoint.authority.epoch,
    revision: checkpoint.authority.sequence,
    schemaVersion: checkpoint.version,
    payload: checkpoint,
  }
}

function socketFixture() {
  const calls = []
  const listeners = new Map()
  return {
    calls,
    async request(action, params) {
      calls.push({ action, params })
      if (action === 'session.state.get') return { state: storedCheckpoint() }
      return { ok: true }
    },
    subscribe(topic, listener) {
      listeners.set(topic, listener)
      return () => listeners.delete(topic)
    },
  }
}

function nextTurn() {
  return new Promise((resolve) => setImmediate(resolve))
}

test('guest pickup intent is relayed and throttled instead of mutating the local world', async () => {
  const scene = sceneFixture()
  const socket = socketFixture()
  let logicalNow = 1000
  const runtime = createDungeonNetworkRuntime({
    socket,
    scene,
    roomId: 'ABC123',
    runSeed: 'ABC123',
    localPlayerId: 'guest',
    hostId: 'host',
    now: () => logicalNow,
    setIntervalImpl: () => 77,
    clearIntervalImpl: () => {},
  })

  runtime.start()
  await nextTurn()

  const handler = scene.__dungeonPickupRuntime.getPickupIntentHandler()
  const drop = { id: 'drop:ABC123:1:0' }

  assert.equal(typeof handler, 'function')
  assert.equal(handler(scene.localPlayer, drop), true)
  assert.equal(handler(scene.localPlayer, drop), true)
  await Promise.resolve()

  let commands = socket.calls.filter((call) => call.action === 'dungeon.command')
  assert.equal(commands.length, 1)
  assert.deepEqual(commands[0].params.command, { type: 'pickup', dropId: drop.id })

  logicalNow += 251
  handler(scene.localPlayer, drop)
  await Promise.resolve()
  commands = socket.calls.filter((call) => call.action === 'dungeon.command')
  assert.equal(commands.length, 2)

  runtime.stop()
  assert.equal(scene.__dungeonPickupRuntime.getPickupIntentHandler(), null)
})