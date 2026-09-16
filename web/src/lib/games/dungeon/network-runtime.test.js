import test from 'node:test'
import assert from 'node:assert/strict'

import { attachLocalPlayerEntity } from './player-entity.js'
import { createDungeonNetworkRuntime } from './network-runtime.js'

function state(x = 0) {
  return {
    x,
    y: 20,
    hp: 100,
    maxHp: 100,
    damage: 10,
    critChance: 0,
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
    players: new Map(),
    enemies: [],
    time: { now: 1000 },
    makeActor(x, y) {
      return {
        x,
        y,
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
  attachLocalPlayerEntity(scene, { id: localId, state: state(10) })
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
    subscribe(action, listener) {
      listeners.set(action, listener)
      return () => listeners.delete(action)
    },
  }
}

function roomMessage(payload) {
  return { data: { topicId: 'room:ABC123', message: payload } }
}

function nextTurn() {
  return new Promise((resolve) => setImmediate(resolve))
}

test('network runtime rekeys the default local PlayerEntity to the authenticated player id', () => {
  const scene = sceneFixture('local')
  const player = scene.localPlayer
  const socket = socketFixture()

  createDungeonNetworkRuntime({ socket, scene, roomId: 'ABC123', localPlayerId: 'session-7', hostId: 'session-7' })

  assert.equal(scene.localPlayer, player)
  assert.equal(player.id, 'session-7')
  assert.equal(scene.players.has('local'), false)
  assert.equal(scene.players.get('session-7'), player)
})

test('remote snapshot trusts relay playerId instead of spoofed snapshot id', () => {
  const scene = sceneFixture('host')
  const socket = socketFixture()
  const runtime = createDungeonNetworkRuntime({
    socket,
    scene,
    roomId: 'ABC123',
    localPlayerId: 'host',
    hostId: 'host',
  })

  runtime.handleMessage(roomMessage({
    type: 'dungeon.snapshot',
    playerId: 'guest',
    snapshot: { id: 'spoofed', state: state(120), facing: 'left' },
  }))

  assert.equal(scene.players.has('spoofed'), false)
  assert.equal(scene.players.get('guest')?.state.x, 120)
  assert.equal(scene.players.get('guest')?.facing, 'left')
})

test('later remote snapshots update the existing player presentation', () => {
  const scene = sceneFixture('host')
  const socket = socketFixture()
  const runtime = createDungeonNetworkRuntime({ socket, scene, roomId: 'ABC123', localPlayerId: 'host', hostId: 'host' })

  runtime.handleMessage(roomMessage({ type: 'dungeon.snapshot', playerId: 'guest', snapshot: { id: 'guest', state: state(100) } }))
  const guest = scene.players.get('guest')
  runtime.handleMessage(roomMessage({ type: 'dungeon.snapshot', playerId: 'guest', snapshot: { id: 'guest', state: state(180), moving: true } }))

  assert.equal(scene.players.get('guest'), guest)
  assert.equal(guest.state.x, 180)
  assert.equal(guest.actor.x, 180)
  assert.equal(guest.moving, true)
})

test('current authority executes guest semantic commands using relay identity and authority time', () => {
  const scene = sceneFixture('host')
  const socket = socketFixture()
  scene.autoAttack = (time, player) => { player.lastAttackAt = time }
  const runtime = createDungeonNetworkRuntime({
    socket,
    scene,
    roomId: 'ABC123',
    localPlayerId: 'host',
    hostId: 'host',
    now: () => 1500,
  })
  runtime.handleMessage(roomMessage({ type: 'dungeon.snapshot', playerId: 'guest', snapshot: { id: 'guest', state: state(100) } }))

  runtime.handleMessage(roomMessage({
    type: 'dungeon.command',
    playerId: 'guest',
    command: { type: 'attack', playerId: 'spoofed', time: 999999 },
  }))

  assert.equal(scene.players.get('guest').lastAttackAt, 1500)
  assert.equal(scene.players.has('spoofed'), false)
})

test('follower never authors gameplay when another client sends a command', () => {
  const scene = sceneFixture('guest')
  const socket = socketFixture()
  let attacks = 0
  scene.autoAttack = () => { attacks++ }
  const runtime = createDungeonNetworkRuntime({ socket, scene, roomId: 'ABC123', localPlayerId: 'guest', hostId: 'host' })

  runtime.handleMessage(roomMessage({ type: 'dungeon.command', playerId: 'host', command: { type: 'attack', time: 1500 } }))

  assert.equal(attacks, 0)
})

test('snapshot flush sends only the local serializable player state', async () => {
  const scene = sceneFixture('guest')
  const socket = socketFixture()
  scene.localPlayer.actor = { phaser: true }
  scene.localPlayer.runtime.weaponVisuals = { visual: { phaser: true } }
  const runtime = createDungeonNetworkRuntime({ socket, scene, roomId: 'ABC123', localPlayerId: 'guest', hostId: 'host' })

  await runtime.flushSnapshot()

  assert.equal(socket.calls.length, 1)
  assert.equal(socket.calls[0].action, 'dungeon.snapshot')
  assert.equal(socket.calls[0].params.roomId, 'ABC123')
  assert.equal(socket.calls[0].params.snapshot.id, 'guest')
  assert.equal('actor' in socket.calls[0].params.snapshot, false)
  assert.equal('runtime' in socket.calls[0].params.snapshot, false)
})

test('fresh follower requests canonical session state from server without peer checkpoint snapshots', async () => {
  const scene = sceneFixture('guest')
  const socket = socketFixture({ sessionStates: [null] })
  const runtime = createDungeonNetworkRuntime({
    socket,
    scene,
    roomId: 'ABC123',
    localPlayerId: 'guest',
    hostId: 'host',
    setIntervalImpl: () => 77,
    clearIntervalImpl: () => {},
  })

  runtime.start()
  await nextTurn()

  assert.equal(socket.calls.filter((call) => call.action === 'session.state.get').length, 1)
  assert.equal(socket.calls.filter((call) => call.action === 'dungeon.snapshot').length, 0)
  assert.equal(await runtime.flushSnapshot(), false)
  assert.equal(socket.calls.filter((call) => call.action === 'dungeon.snapshot').length, 0)
  runtime.stop()
})

test('fresh authority initializes missing server session state before publishing snapshots', async () => {
  const scene = sceneFixture('host')
  scene.floor = 4
  const socket = socketFixture({ sessionStates: [null] })
  const runtime = createDungeonNetworkRuntime({
    socket,
    scene,
    roomId: 'ABC123',
    localPlayerId: 'host',
    hostId: 'host',
    setIntervalImpl: () => 77,
    clearIntervalImpl: () => {},
  })

  runtime.start()
  await nextTurn()
  await nextTurn()

  const get = socket.calls.find((call) => call.action === 'session.state.get')
  const put = socket.calls.find((call) => call.action === 'session.state.put')
  const fact = socket.calls
    .filter((call) => call.action === 'dungeon.fact')
    .map((call) => call.params.fact)
    .find((candidate) => candidate?.type === 'session.checkpoint')
  const snapshot = socket.calls.find((call) => call.action === 'dungeon.snapshot')?.params.snapshot

  assert.equal(get?.params.roomId, 'ABC123')
  assert.equal(put?.params.payload.world.floor, 4)
  assert.equal(fact?.checkpoint?.world?.floor, 4)
  assert.equal('syncCheckpoint' in (snapshot ?? {}), false)
  assert.equal('recoverCheckpoint' in (snapshot ?? {}), false)
  runtime.stop()
})

test('follower forwards explicit local player intents as clock-free semantic commands', async () => {
  const scene = sceneFixture('guest')
  const socket = socketFixture()
  const runtime = createDungeonNetworkRuntime({ socket, scene, roomId: 'ABC123', localPlayerId: 'guest', hostId: 'host' })

  assert.equal(runtime.handleLocalIntent({ type: 'attack', playerId: 'guest' }), true)
  assert.equal(runtime.handleLocalIntent({ type: 'skill', playerId: 'guest', skillId: 'primary' }), true)
  assert.equal(runtime.handleLocalIntent({ type: 'attack', playerId: 'spoofed' }), false)
  await Promise.resolve()
  await Promise.resolve()

  const commands = socket.calls.filter((call) => call.action === 'dungeon.command')
  assert.deepEqual(commands.map((call) => call.params.command), [
    { type: 'attack' },
    { type: 'skill', skillId: 'primary' },
  ])
})

test('authority ignores local player intents because it already owns gameplay', async () => {
  const scene = sceneFixture('host')
  const socket = socketFixture()
  const runtime = createDungeonNetworkRuntime({ socket, scene, roomId: 'ABC123', localPlayerId: 'host', hostId: 'host' })

  assert.equal(runtime.handleLocalIntent({ type: 'attack', playerId: 'host' }), false)
  await Promise.resolve()

  assert.equal(socket.calls.some((call) => call.action === 'dungeon.command'), false)
})

test('stop unsubscribes and despawns remote players without touching local player', () => {
  const scene = sceneFixture('host')
  const socket = socketFixture()
  let cleared = null
  const runtime = createDungeonNetworkRuntime({
    socket,
    scene,
    roomId: 'ABC123',
    localPlayerId: 'host',
    hostId: 'host',
    setIntervalImpl: () => 77,
    clearIntervalImpl: (id) => { cleared = id },
  })
  runtime.start()
  runtime.handleMessage(roomMessage({ type: 'dungeon.snapshot', playerId: 'guest', snapshot: { id: 'guest', state: state(100) } }))

  runtime.stop()

  assert.equal(cleared, 77)
  assert.equal(socket.listeners.has('room:ABC123'), false)
  assert.equal(scene.players.has('guest'), false)
  assert.equal(scene.players.get('host'), scene.localPlayer)
})
