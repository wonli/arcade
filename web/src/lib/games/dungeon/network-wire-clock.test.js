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
    equipment: { weapon: null },
    modifiers: {},
  }
}

function sceneFixture(localId = 'guest') {
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
  attachLocalPlayerEntity(scene, { id: localId, state: state(10) })
  return scene
}

function socketFixture() {
  const calls = []
  return {
    calls,
    async request(action, params) {
      calls.push({ action, params })
      return { ok: true }
    },
    subscribe() { return () => {} },
  }
}

function roomMessage(payload) {
  return { data: { topicId: 'room:ABC123', message: payload } }
}

test('snapshot wire payload never exposes the sender gameplay clock epoch', async () => {
  const scene = sceneFixture('guest')
  const socket = socketFixture()
  scene.localPlayer.lastAttackAt = 9600
  scene.localPlayer.lastContactAt = 9800
  scene.localPlayer.runtime.skills = { cooldowns: { primary: 13000 } }
  scene.localPlayer.state.hasteUntil = 11200

  const runtime = createDungeonNetworkRuntime({
    socket,
    scene,
    roomId: 'ABC123',
    localPlayerId: 'guest',
    hostId: 'host',
    now: () => 10000,
  })

  await runtime.flushSnapshot()
  const snapshot = socket.calls[0].params.snapshot

  assert.equal('lastAttackAt' in snapshot, false)
  assert.equal('lastContactAt' in snapshot, false)
  assert.equal('skillCooldowns' in snapshot, false)
  assert.equal('hasteUntil' in snapshot.state, false)
  assert.equal(snapshot.lastAttackElapsedMs, 400)
  assert.equal(snapshot.lastContactElapsedMs, 200)
  assert.deepEqual(snapshot.skillCooldownRemainingMs, { primary: 3000 })
  assert.equal(snapshot.state.hasteRemainingMs, 1200)
})

test('unknown peer bootstrap reanchors portable snapshot timers onto authority time', () => {
  const scene = sceneFixture('host')
  const socket = socketFixture()
  const runtime = createDungeonNetworkRuntime({
    socket,
    scene,
    roomId: 'ABC123',
    localPlayerId: 'host',
    hostId: 'host',
    now: () => 250,
  })

  runtime.handleMessage(roomMessage({
    type: 'dungeon.snapshot',
    playerId: 'guest',
    snapshot: {
      id: 'guest',
      state: { ...state(120), hasteRemainingMs: 1200 },
      lastAttackElapsedMs: 400,
      lastContactElapsedMs: 200,
      skillCooldownRemainingMs: { primary: 3000 },
    },
  }))

  const guest = scene.players.get('guest')
  assert.equal(guest.lastAttackAt, -150)
  assert.equal(guest.lastContactAt, 50)
  assert.deepEqual(guest.runtime.skills.cooldowns, { primary: 3250 })
  assert.equal(guest.state.hasteUntil, 1450)
})

test('outgoing world facts convert enemy gameplay timestamps before transport', async () => {
  const scene = sceneFixture('host')
  const socket = socketFixture()
  const runtime = createDungeonNetworkRuntime({
    socket,
    scene,
    roomId: 'ABC123',
    localPlayerId: 'host',
    hostId: 'host',
    now: () => 10000,
  })

  await runtime.sendFact({
    type: 'world.state',
    floor: 1,
    enemies: [{ id: 'enemy:ABC123:1:0', hp: 80, nextChargeAt: 14000 }],
  })

  const fact = socket.calls.find((call) => call.action === 'dungeon.fact').params.fact
  assert.equal('nextChargeAt' in fact.enemies[0], false)
  assert.equal(fact.enemies[0].nextChargeRemainingMs, 4000)
})

test('incoming world facts reanchor portable enemy timers before gameplay applies them', () => {
  const scene = sceneFixture('guest')
  const socket = socketFixture()
  let observed = null
  const runtime = createDungeonNetworkRuntime({
    socket,
    scene,
    roomId: 'ABC123',
    localPlayerId: 'guest',
    hostId: 'host',
    now: () => 250,
    onFact(_fact, context) { observed = context?.applied ?? null },
  })

  runtime.handleMessage(roomMessage({
    type: 'dungeon.fact',
    playerId: 'host',
    fact: {
      type: 'world.state',
      floor: 1,
      epoch: 1,
      authorityId: 'host',
      sequence: 1,
      enemies: [{ id: 'enemy:ABC123:1:0', hp: 80, nextChargeRemainingMs: 4000 }],
    },
  }))

  assert.equal(observed.enemies[0].nextChargeAt, 4250)
  assert.equal('nextChargeRemainingMs' in observed.enemies[0], false)
})
