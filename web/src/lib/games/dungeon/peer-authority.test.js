import test from 'node:test'
import assert from 'node:assert/strict'

import { attachLocalPlayerEntity } from './player-entity.js'
import { createDungeonNetworkRuntime } from './network-runtime.js'
import { serializePlayerSnapshot } from './player-snapshot.js'
import { createSessionCheckpoint } from './session-runtime.js'

function playerState(x = 0) {
  return { x, y: 20, hp: 100, maxHp: 100, damage: 10, healthPotions: 1, equipment: { weapon: null }, modifiers: {} }
}

function sceneFixture(localId) {
  const scene = {
    floor: 7,
    kills: 0,
    floorKills: 0,
    floorCleared: false,
    runComplete: false,
    portal: null,
    drops: [],
    enemies: [],
    players: new Map(),
    time: { now: 1000 },
    makeActor(x, y) { return { x, y, setDepth() { return this }, setPosition(nx, ny) { this.x = nx; this.y = ny; return this }, destroy() {} } },
    createHealthBar() { return { destroy() {} } },
    updateHealthBar() {},
    syncPlayerAnimation() {},
    emitStats() {},
  }
  attachLocalPlayerEntity(scene, { id: localId, state: playerState(10) })
  return scene
}

function socketFixture() {
  const calls = []
  return {
    calls,
    async request(action, params) { calls.push({ action, params }); return { ok: true } },
    subscribe() { return () => {} },
  }
}

function checkpoint() {
  const hostScene = sceneFixture('host')
  const guestScene = sceneFixture('guest')
  return createSessionCheckpoint({
    roomId: 'ABC123',
    runSeed: 'ABC123',
    authority: { epoch: 1, authorityId: 'host', sequence: 5 },
    status: 'playing',
    world: { type: 'world.state', floor: 7, enemies: [], drops: [], portal: null },
    players: {
      host: serializePlayerSnapshot(hostScene.localPlayer),
      guest: serializePlayerSnapshot(guestScene.localPlayer),
    },
    lifecycle: {
      host: { status: 'alive', respawnRemainingMs: 0, invulnerabilityRemainingMs: 0 },
      guest: { status: 'alive', respawnRemainingMs: 0, invulnerabilityRemainingMs: 0 },
    },
    openedChestIds: [],
  })
}

function roomMessage(payload) {
  return { data: { topicId: 'room:ABC123', message: payload } }
}

function nextTurn() { return new Promise((resolve) => setImmediate(resolve)) }

function followerRuntime() {
  const socket = socketFixture()
  const runtime = createDungeonNetworkRuntime({ socket, scene: sceneFixture('guest'), roomId: 'ABC123', localPlayerId: 'guest', hostId: 'host' })
  runtime.handleMessage(roomMessage({
    type: 'dungeon.fact',
    playerId: 'host',
    fact: { type: 'session.checkpoint', checkpoint: checkpoint() },
  }))
  return { socket, runtime }
}

test('surviving peer takes authority when current authority leaves room membership', async () => {
  const { socket, runtime } = followerRuntime()

  const takeover = runtime.updatePeers([{ id: 'guest' }])
  await nextTurn()
  await nextTurn()

  assert.equal(takeover?.authority?.authorityId, 'guest')
  assert.equal(takeover?.authority?.epoch, 2)
  assert.equal(runtime.isAuthority(), true)
  const claim = socket.calls.filter((call) => call.action === 'dungeon.fact').map((call) => call.params.fact).find((fact) => fact?.type === 'session.checkpoint')
  assert.equal(claim?.checkpoint?.authority?.authorityId, 'guest')
  assert.equal(claim?.checkpoint?.authority?.epoch, 2)
})

test('membership update does not trigger takeover while current authority remains', () => {
  const { socket, runtime } = followerRuntime()
  socket.calls.length = 0

  const result = runtime.updatePeers([{ id: 'host' }, { id: 'guest' }])

  assert.equal(result, null)
  assert.equal(runtime.isAuthority(), false)
  assert.equal(socket.calls.some((call) => call.action === 'dungeon.fact'), false)
})

test('reconnecting initial host cannot reclaim newer authority from room metadata', () => {
  const { runtime } = followerRuntime()
  runtime.updatePeers([{ id: 'guest' }])
  assert.equal(runtime.isAuthority(), true)

  const result = runtime.updatePeers([{ id: 'host' }, { id: 'guest' }])

  assert.equal(result, null)
  assert.equal(runtime.authority().authorityId, 'guest')
  assert.equal(runtime.authority().epoch, 2)
})
