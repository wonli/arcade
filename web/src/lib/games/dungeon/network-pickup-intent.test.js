import test from 'node:test'
import assert from 'node:assert/strict'

import { attachLocalPlayerEntity } from './player-entity.js'
import { createDungeonNetworkRuntime } from './network-runtime.js'

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
    state: { x: 100, y: 100, hp: 100, maxHp: 100, equipment: { weapon: null }, modifiers: {} },
  })
  return scene
}

function socketFixture() {
  const calls = []
  const listeners = new Map()
  return {
    calls,
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

test('guest pickup intent is relayed and throttled instead of mutating the local world', async () => {
  const scene = sceneFixture()
  const socket = socketFixture()
  const runtime = createDungeonNetworkRuntime({
    socket,
    scene,
    roomId: 'ABC123',
    runSeed: 'ABC123',
    localPlayerId: 'guest',
    hostId: 'host',
    setIntervalImpl: () => 77,
    clearIntervalImpl: () => {},
  })

  runtime.start()
  const handler = scene.__dungeonPickupRuntime.getPickupIntentHandler()
  const drop = { id: 'drop:ABC123:1:0' }

  assert.equal(typeof handler, 'function')
  assert.equal(handler(scene.localPlayer, drop), true)
  assert.equal(handler(scene.localPlayer, drop), true)
  await Promise.resolve()

  let commands = socket.calls.filter((call) => call.action === 'dungeon.command')
  assert.equal(commands.length, 1)
  assert.deepEqual(commands[0].params.command, { type: 'pickup', dropId: drop.id })

  scene.time.now += 251
  handler(scene.localPlayer, drop)
  await Promise.resolve()
  commands = socket.calls.filter((call) => call.action === 'dungeon.command')
  assert.equal(commands.length, 2)

  runtime.stop()
  assert.equal(scene.__dungeonPickupRuntime.getPickupIntentHandler(), null)
})
