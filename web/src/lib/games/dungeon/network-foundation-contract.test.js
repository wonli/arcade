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
    healthPotions: 0,
    equipment: { weapon: null },
    modifiers: {},
  }
}

function textNode() {
  return {
    setOrigin() { return this },
    setDepth() { return this },
    setText() { return this },
    setPosition() { return this },
    destroy() { this.destroyed = true },
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
    add: { text() { return textNode() } },
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

function checkpointForGuest() {
  return {
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
      host: { id: 'host', state: state(20) },
      guest: { id: 'guest', state: state(40) },
    },
    lifecycle: {
      host: { status: 'alive', respawnRemainingMs: 0, invulnerabilityRemainingMs: 0 },
      guest: { status: 'alive', respawnRemainingMs: 0, invulnerabilityRemainingMs: 0 },
    },
    openedChestIds: [],
  }
}

test('follower exposes explicit BOOTSTRAP -> HYDRATING -> LIVE synchronization phases', () => {
  const runtime = createDungeonNetworkRuntime({
    socket: socketFixture(),
    scene: sceneFixture('guest'),
    roomId: 'ABC123',
    localPlayerId: 'guest',
    hostId: 'host',
    setIntervalImpl: () => 7,
    clearIntervalImpl: () => {},
  })

  assert.equal(typeof runtime.syncPhase, 'function')
  assert.equal(runtime.syncPhase(), 'BOOTSTRAP')

  runtime.start()
  assert.equal(runtime.syncPhase(), 'HYDRATING')

  runtime.handleMessage(roomMessage({
    type: 'dungeon.fact',
    playerId: 'host',
    fact: { type: 'session.checkpoint', checkpoint: checkpointForGuest() },
  }))

  assert.equal(runtime.syncPhase(), 'LIVE')
  runtime.stop()
})

test('network start never replaces gameplay Scene methods', () => {
  const scene = sceneFixture('guest')
  const originalAttack = function autoAttack(time, player) {
    player.lastAttackAt = time
  }
  const originalSkill = function trySkill() {
    return false
  }
  scene.autoAttack = originalAttack
  scene.trySkill = originalSkill

  const runtime = createDungeonNetworkRuntime({
    socket: socketFixture(),
    scene,
    roomId: 'ABC123',
    localPlayerId: 'guest',
    hostId: 'host',
    setIntervalImpl: () => 7,
    clearIntervalImpl: () => {},
  })

  runtime.start()

  assert.equal(scene.autoAttack, originalAttack)
  assert.equal(scene.trySkill, originalSkill)
  runtime.stop()
})

test('authority executes attack commands through the owned combat capability', () => {
  const scene = sceneFixture('host')
  const socket = socketFixture()
  let legacyAttackCalls = 0
  const capabilityCalls = []

  scene.autoAttack = (time, player) => {
    legacyAttackCalls++
    player.lastAttackAt = time
  }
  scene.dungeon = {
    combat: {
      attack(player, time) {
        capabilityCalls.push({ playerId: player.id, time })
        player.lastAttackAt = time
      },
    },
  }

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
    snapshot: { id: 'spoofed', state: state(100) },
  }))
  runtime.handleMessage(roomMessage({
    type: 'dungeon.command',
    playerId: 'guest',
    command: { type: 'attack', playerId: 'spoofed', time: 1500 },
  }))

  assert.equal(legacyAttackCalls, 0)
  assert.deepEqual(capabilityCalls, [{ playerId: 'guest', time: 1500 }])
})
