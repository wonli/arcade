import test from 'node:test'
import assert from 'node:assert/strict'

import { attachLocalPlayerEntity, attachPlayerEntity } from './player-entity.js'
import {
  applyDungeonStateEnvelope,
  createDungeonNetworkRuntime,
  createDungeonStateEnvelope,
} from './dungeon-network-runtime.js'

function state(x = 0) {
  return {
    x,
    y: 20,
    hp: 100,
    maxHp: 100,
    damage: 10,
    speed: 190,
    equipment: { weapon: null },
    modifiers: {},
  }
}

function sceneFixture(localId = 'p1') {
  const scene = {
    players: new Map(),
    enemies: [],
    syncPlayerAnimation() {},
    updateHealthBar() {},
    makeActor(x, y) {
      return {
        x,
        y,
        setDepth() { return this },
        setPosition(nextX, nextY) { this.x = nextX; this.y = nextY; return this },
        destroy() { this.destroyed = true },
      }
    },
    createHealthBar() {
      return { destroy() { this.destroyed = true } }
    },
  }
  const local = attachLocalPlayerEntity(scene, { id: localId, state: state(0) })
  return { scene, local }
}

function fakeSocket() {
  const listeners = new Map()
  const requests = []
  return {
    listeners,
    requests,
    request(action, params) {
      requests.push({ action, params })
      return Promise.resolve({ ok: true })
    },
    subscribe(topic, listener) {
      listeners.set(topic, listener)
      return () => listeners.delete(topic)
    },
    emit(topic, payload) {
      listeners.get(topic)?.({ data: { topicId: topic, message: payload } })
    },
  }
}

test('state envelope serializes every registered player as plain network data', () => {
  const { scene, local } = sceneFixture('p1')
  const remote = attachPlayerEntity(scene, { id: 'p2', state: state(40) })
  local.actor = { phaser: true }
  remote.runtime.weaponVisuals = { restore() {} }

  const envelope = createDungeonStateEnvelope(scene, 7)

  assert.equal(envelope.sequence, 7)
  assert.deepEqual(envelope.players.map((player) => player.id), ['p1', 'p2'])
  assert.equal(JSON.stringify(envelope).includes('phaser'), false)
  assert.equal(JSON.stringify(envelope).includes('weaponVisuals'), false)
})

test('applying host state updates local entity, spawns remotes and removes missing remotes', () => {
  const { scene, local } = sceneFixture('p2')
  const stale = attachPlayerEntity(scene, { id: 'gone', state: state(90) })
  stale.actor = { destroy() { this.destroyed = true } }

  const localRef = local
  applyDungeonStateEnvelope(scene, {
    sequence: 3,
    players: [
      { id: 'p1', state: state(55), facing: 'left', moving: true, attacking: false, dead: false, lastAttackAt: 0, lastContactAt: 0, skillCooldowns: {} },
      { id: 'p2', state: { ...state(25), hp: 77 }, facing: 'right', moving: false, attacking: true, dead: false, lastAttackAt: 400, lastContactAt: 0, skillCooldowns: {} },
    ],
  })

  assert.equal(scene.localPlayer, localRef)
  assert.equal(local.state.x, 25)
  assert.equal(local.state.hp, 77)
  assert.equal(local.attacking, true)
  assert.equal(scene.players.get('p1').state.x, 55)
  assert.equal(scene.players.get('p1').actor.x, 55)
  assert.equal(scene.players.has('gone'), false)
})

test('host executes room input using authenticated envelope player id instead of spoofed command id', () => {
  const { scene } = sceneFixture('p1')
  const p2 = attachPlayerEntity(scene, { id: 'p2', state: state(40) })
  let attack = null
  scene.autoAttack = (time, player) => { attack = { time, player } }
  const socket = fakeSocket()

  const runtime = createDungeonNetworkRuntime(scene, {
    socket,
    roomId: 'ABC123',
    playerId: 'p1',
    hostId: 'p1',
    setIntervalImpl: () => 1,
    clearIntervalImpl() {},
  })

  socket.emit('room:ABC123', {
    type: 'dungeon.input',
    playerId: 'p2',
    input: { type: 'attack', playerId: 'p1', time: 900 },
  })

  assert.deepEqual(attack, { time: 900, player: p2 })
  runtime.stop()
})

test('guest accepts only newer state from room host', () => {
  const { scene } = sceneFixture('p2')
  const socket = fakeSocket()
  const runtime = createDungeonNetworkRuntime(scene, {
    socket,
    roomId: 'ABC123',
    playerId: 'p2',
    hostId: 'p1',
  })

  const stateMessage = (sequence, x, playerId = 'p1') => ({
    type: 'dungeon.state',
    playerId,
    state: {
      sequence,
      players: [
        { id: 'p1', state: state(80), facing: 'down', moving: false, attacking: false, dead: false, lastAttackAt: 0, lastContactAt: 0, skillCooldowns: {} },
        { id: 'p2', state: state(x), facing: 'down', moving: false, attacking: false, dead: false, lastAttackAt: 0, lastContactAt: 0, skillCooldowns: {} },
      ],
    },
  })

  socket.emit('room:ABC123', stateMessage(2, 30))
  socket.emit('room:ABC123', stateMessage(1, 10))
  socket.emit('room:ABC123', stateMessage(3, 99, 'intruder'))

  assert.equal(scene.localPlayer.state.x, 30)
  assert.equal(runtime.lastSequence(), 2)
  runtime.stop()
})

test('host snapshot publisher suppresses overlapping state requests', async () => {
  const { scene } = sceneFixture('p1')
  const socket = fakeSocket()
  let resolveRequest
  socket.request = (action, params) => {
    socket.requests.push({ action, params })
    return new Promise((resolve) => { resolveRequest = resolve })
  }

  const runtime = createDungeonNetworkRuntime(scene, {
    socket,
    roomId: 'ABC123',
    playerId: 'p1',
    hostId: 'p1',
    setIntervalImpl: () => 1,
    clearIntervalImpl() {},
  })

  const first = runtime.publishState()
  const skipped = await runtime.publishState()

  assert.equal(skipped, false)
  assert.equal(socket.requests.length, 1)
  assert.equal(socket.requests[0].action, 'dungeon.state')
  assert.equal(socket.requests[0].params.state.sequence, 1)

  resolveRequest({ ok: true })
  assert.equal(await first, true)
  const second = runtime.publishState()
  assert.equal(socket.requests.length, 2)
  assert.equal(socket.requests[1].params.state.sequence, 2)
  resolveRequest({ ok: true })
  await second
  runtime.stop()
})

test('guest relays semantic command without trusting a caller supplied player id', async () => {
  const { scene } = sceneFixture('p2')
  const socket = fakeSocket()
  const runtime = createDungeonNetworkRuntime(scene, {
    socket,
    roomId: 'ABC123',
    playerId: 'p2',
    hostId: 'p1',
  })

  await runtime.sendCommand({ type: 'skill', skillId: 'primary', playerId: 'spoofed', time: 1000 })

  assert.deepEqual(socket.requests[0], {
    action: 'dungeon.input',
    params: {
      roomId: 'ABC123',
      input: { type: 'skill', skillId: 'primary', time: 1000 },
    },
  })
  runtime.stop()
})

test('stop unsubscribes room topic and clears host scheduler', () => {
  const { scene } = sceneFixture('p1')
  const socket = fakeSocket()
  let cleared = null
  const runtime = createDungeonNetworkRuntime(scene, {
    socket,
    roomId: 'ABC123',
    playerId: 'p1',
    hostId: 'p1',
    setIntervalImpl: () => 77,
    clearIntervalImpl: (id) => { cleared = id },
  })

  assert.equal(socket.listeners.has('room:ABC123'), true)
  runtime.stop()
  assert.equal(socket.listeners.has('room:ABC123'), false)
  assert.equal(cleared, 77)
})
