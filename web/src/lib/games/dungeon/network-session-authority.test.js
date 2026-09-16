import test from 'node:test'
import assert from 'node:assert/strict'

import { attachLocalPlayerEntity } from './player-entity.js'
import { createDungeonNetworkRuntime } from './network-runtime.js'
import { serializePlayerSnapshot } from './player-snapshot.js'
import { createSessionCheckpoint } from './session-runtime.js'

function state(x = 0, weapon = null) {
  return {
    x,
    y: 20,
    hp: 100,
    maxHp: 100,
    damage: 10,
    healthPotions: 2,
    equipment: { weapon },
    modifiers: {},
  }
}

function sceneFixture(localId) {
  const scene = {
    floor: 4,
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
  attachLocalPlayerEntity(scene, { id: localId, state: state(10) })
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

function nextTurn() {
  return new Promise((resolve) => setImmediate(resolve))
}

function checkpoint({ authorityId = 'host', epoch = 1, sequence = 4, floor = 4, guestWeapon = null, openedChestIds = [] } = {}) {
  const hostScene = sceneFixture('host')
  const guestScene = sceneFixture('guest')
  guestScene.localPlayer.state = state(220, guestWeapon)
  return createSessionCheckpoint({
    roomId: 'ABC123',
    runSeed: 'ABC123',
    authority: { epoch, authorityId, sequence },
    status: 'playing',
    world: { type: 'world.state', floor, enemies: [], drops: [], portal: null },
    players: {
      host: serializePlayerSnapshot(hostScene.localPlayer),
      guest: serializePlayerSnapshot(guestScene.localPlayer),
    },
    lifecycle: {
      host: { status: 'alive', respawnRemainingMs: 0, invulnerabilityRemainingMs: 0 },
      guest: { status: 'alive', respawnRemainingMs: 0, invulnerabilityRemainingMs: 0 },
    },
    openedChestIds,
  })
}

test('room host initializes epoch-one authority but runtime exposes mutable authority state', () => {
  const runtime = createDungeonNetworkRuntime({
    socket: socketFixture(), scene: sceneFixture('host'), roomId: 'ABC123', localPlayerId: 'host', hostId: 'host',
  })

  assert.deepEqual(runtime.authority(), { epoch: 1, authorityId: 'host', sequence: 0 })
  assert.equal(runtime.isAuthority(), true)
})

test('authority facts carry epoch authority id and monotonically increasing sequence', async () => {
  const socket = socketFixture()
  const runtime = createDungeonNetworkRuntime({
    socket, scene: sceneFixture('host'), roomId: 'ABC123', localPlayerId: 'host', hostId: 'host',
  })

  await runtime.sendFact({ type: 'test.fact' })
  await runtime.sendFact({ type: 'test.fact' })

  const facts = socket.calls.filter((call) => call.action === 'dungeon.fact').map((call) => call.params.fact)
  assert.deepEqual(facts.map(({ epoch, authorityId, sequence }) => ({ epoch, authorityId, sequence })), [
    { epoch: 1, authorityId: 'host', sequence: 1 },
    { epoch: 1, authorityId: 'host', sequence: 2 },
  ])
})

test('fresh follower requests durable checkpoint instead of only world state', async () => {
  const socket = socketFixture()
  const runtime = createDungeonNetworkRuntime({
    socket,
    scene: sceneFixture('guest'),
    roomId: 'ABC123',
    localPlayerId: 'guest',
    hostId: 'host',
    setIntervalImpl: () => 7,
    clearIntervalImpl: () => {},
  })

  runtime.start()
  await nextTurn()

  const bootstrap = socket.calls.find((call) => call.action === 'dungeon.snapshot')?.params.snapshot
  assert.equal(bootstrap?.syncCheckpoint, true)
  assert.equal('syncWorld' in bootstrap, false)
  runtime.stop()
})

test('current authority answers checkpoint sync request with session checkpoint', async () => {
  const socket = socketFixture()
  const runtime = createDungeonNetworkRuntime({
    socket,
    scene: sceneFixture('host'),
    roomId: 'ABC123',
    localPlayerId: 'host',
    hostId: 'host',
    setIntervalImpl: () => 7,
    clearIntervalImpl: () => {},
  })
  runtime.start()
  await nextTurn()
  socket.calls.length = 0

  runtime.handleMessage(roomMessage({
    type: 'dungeon.snapshot',
    playerId: 'guest',
    snapshot: { id: 'guest', state: state(200), syncCheckpoint: true },
  }))
  await nextTurn()
  await nextTurn()

  const fact = socket.calls
    .filter((call) => call.action === 'dungeon.fact')
    .map((call) => call.params.fact)
    .find((candidate) => candidate?.type === 'session.checkpoint')
  assert.equal(fact?.type, 'session.checkpoint')
  assert.equal(fact?.checkpoint?.world?.floor, 4)
  assert.equal(fact?.checkpoint?.players?.guest?.state?.x, 200)
  runtime.stop()
})

test('authority checkpoint restores follower durable local equipment', () => {
  const scene = sceneFixture('guest')
  const runtime = createDungeonNetworkRuntime({
    socket: socketFixture(), scene, roomId: 'ABC123', localPlayerId: 'guest', hostId: 'host',
  })
  const weapon = { type: 'weapon.void_edge', rarity: 'epic', damage: 24, affixes: [{ id: 'crit', value: 0.2 }] }

  runtime.handleMessage(roomMessage({
    type: 'dungeon.fact',
    playerId: 'host',
    fact: { type: 'session.checkpoint', checkpoint: checkpoint({ authorityId: 'host', epoch: 1, sequence: 5, floor: 9, guestWeapon: weapon }) },
  }))

  assert.deepEqual(runtime.authority(), { epoch: 1, authorityId: 'host', sequence: 5 })
  assert.equal(runtime.isAuthority(), false)
  assert.deepEqual(scene.localPlayer.state.equipment.weapon, weapon)
  assert.equal(scene.floor, 9)
})

test('checkpoint restores opened chest presentation through the spatial owner', () => {
  const scene = sceneFixture('guest')
  let restored = null
  scene.__dungeonSpatial = {
    applyOpenedChestIds(ids) { restored = [...ids] },
  }
  const runtime = createDungeonNetworkRuntime({
    socket: socketFixture(), scene, roomId: 'ABC123', localPlayerId: 'guest', hostId: 'host',
  })

  runtime.handleMessage(roomMessage({
    type: 'dungeon.fact',
    playerId: 'host',
    fact: {
      type: 'session.checkpoint',
      checkpoint: checkpoint({
        authorityId: 'host', epoch: 1, sequence: 5, floor: 9,
        openedChestIds: ['floor-9:chest-0'],
      }),
    },
  }))

  assert.deepEqual(restored, ['floor-9:chest-0'])
})

test('newer checkpoint from surviving peer transfers authority on former host', () => {
  const scene = sceneFixture('host')
  const runtime = createDungeonNetworkRuntime({
    socket: socketFixture(), scene, roomId: 'ABC123', localPlayerId: 'host', hostId: 'host',
  })

  runtime.handleMessage(roomMessage({
    type: 'dungeon.fact',
    playerId: 'guest',
    fact: { type: 'session.checkpoint', checkpoint: checkpoint({ authorityId: 'guest', epoch: 2, sequence: 0, floor: 8 }) },
  }))

  assert.deepEqual(runtime.authority(), { epoch: 2, authorityId: 'guest', sequence: 0 })
  assert.equal(runtime.isAuthority(), false)
  assert.equal(scene.floor, 8)
})

test('stale former-authority fact is rejected after local survivor takeover', () => {
  const scene = sceneFixture('guest')
  const runtime = createDungeonNetworkRuntime({
    socket: socketFixture(), scene, roomId: 'ABC123', localPlayerId: 'guest', hostId: 'host',
  })
  runtime.handleMessage(roomMessage({
    type: 'dungeon.fact',
    playerId: 'host',
    fact: { type: 'session.checkpoint', checkpoint: checkpoint({ authorityId: 'host', epoch: 1, sequence: 5, floor: 8 }) },
  }))

  runtime.takeAuthority()
  assert.equal(runtime.isAuthority(), true)

  runtime.handleMessage(roomMessage({
    type: 'dungeon.fact',
    playerId: 'host',
    fact: { type: 'world.state', epoch: 1, authorityId: 'host', sequence: 999, runSeed: 'ABC123', floor: 1, enemies: [], drops: [], portal: null },
  }))

  assert.equal(scene.floor, 8)
})

test('manual takeover increments epoch and keeps replicated checkpoint state', () => {
  const scene = sceneFixture('guest')
  const runtime = createDungeonNetworkRuntime({
    socket: socketFixture(), scene, roomId: 'ABC123', localPlayerId: 'guest', hostId: 'host',
  })
  runtime.handleMessage(roomMessage({
    type: 'dungeon.fact',
    playerId: 'host',
    fact: { type: 'session.checkpoint', checkpoint: checkpoint({ authorityId: 'host', epoch: 1, sequence: 5, floor: 11 }) },
  }))

  const takeover = runtime.takeAuthority()
  assert.deepEqual(takeover.authority, { epoch: 2, authorityId: 'guest', sequence: 0 })
  assert.equal(takeover.world.floor, 11)
  assert.equal(runtime.isAuthority(), true)
})

test('live follower takeover rebinds world runtime as authority', async () => {
  const runtime = createDungeonNetworkRuntime({
    socket: socketFixture(),
    scene: sceneFixture('guest'),
    roomId: 'ABC123',
    localPlayerId: 'guest',
    hostId: 'host',
    setIntervalImpl: () => 7,
    clearIntervalImpl: () => {},
  })
  runtime.start()
  runtime.handleMessage(roomMessage({
    type: 'dungeon.fact',
    playerId: 'host',
    fact: { type: 'session.checkpoint', checkpoint: checkpoint({ authorityId: 'host', epoch: 1, sequence: 5, floor: 8 }) },
  }))

  assert.equal(runtime.world()?.isHost, false)
  runtime.takeAuthority()
  await nextTurn()

  assert.equal(runtime.isAuthority(), true)
  assert.equal(runtime.world()?.isHost, true)
  runtime.stop()
})

test('live former host rebinds world runtime as follower after newer checkpoint', () => {
  const runtime = createDungeonNetworkRuntime({
    socket: socketFixture(),
    scene: sceneFixture('host'),
    roomId: 'ABC123',
    localPlayerId: 'host',
    hostId: 'host',
    setIntervalImpl: () => 7,
    clearIntervalImpl: () => {},
  })
  runtime.start()
  assert.equal(runtime.world()?.isHost, true)

  runtime.handleMessage(roomMessage({
    type: 'dungeon.fact',
    playerId: 'guest',
    fact: { type: 'session.checkpoint', checkpoint: checkpoint({ authorityId: 'guest', epoch: 2, sequence: 0, floor: 8 }) },
  }))

  assert.equal(runtime.isAuthority(), false)
  assert.equal(runtime.world()?.isHost, false)
  runtime.stop()
})

test('follower chest interaction is delegated as an open_chest command', async () => {
  const socket = socketFixture()
  const scene = sceneFixture('guest')
  let chestIntent = null
  scene.__dungeonSpatial = {
    setChestIntentHandler(handler) { chestIntent = handler; return null },
    setChestOpenedHandler() { return null },
  }
  const runtime = createDungeonNetworkRuntime({
    socket, scene, roomId: 'ABC123', localPlayerId: 'guest', hostId: 'host',
    setIntervalImpl: () => 7,
    clearIntervalImpl: () => {},
  })
  runtime.start()
  socket.calls.length = 0

  const delegated = chestIntent?.(scene.localPlayer, { id: 'floor-4:chest-0' })
  await nextTurn()

  assert.equal(delegated, true)
  const call = socket.calls.find((candidate) => candidate.action === 'dungeon.command')
  assert.deepEqual(call?.params?.command, { type: 'open_chest', chestId: 'floor-4:chest-0' })
  runtime.stop()
})

test('authority death and three-second revive are checkpointed by the network lifecycle owner', async () => {
  const socket = socketFixture()
  const scene = sceneFixture('host')
  let gameOvers = 0
  let intervalCallback = null
  scene.players.set('guest', { id: 'guest', state: state(80), dead: false, runtime: {} })
  scene.gameOver = () => { gameOvers++ }
  scene.hitPlayer = function hitPlayer(damage, player = scene.localPlayer) {
    player.state.hp = Math.max(0, player.state.hp - damage)
    if (player.state.hp <= 0) scene.gameOver(player)
  }
  const runtime = createDungeonNetworkRuntime({
    socket, scene, roomId: 'ABC123', localPlayerId: 'host', hostId: 'host',
    setIntervalImpl(callback) { intervalCallback = callback; return 7 },
    clearIntervalImpl: () => {},
  })
  runtime.start()
  socket.calls.length = 0

  scene.hitPlayer(999, scene.localPlayer)
  await nextTurn()
  await nextTurn()

  assert.equal(scene.localPlayer.dead, true)
  assert.equal(gameOvers, 0)
  let checkpoints = socket.calls
    .filter((call) => call.action === 'dungeon.fact' && call.params.fact?.type === 'session.checkpoint')
    .map((call) => call.params.fact.checkpoint)
  assert.equal(checkpoints.at(-1)?.lifecycle?.host?.status, 'downed')
  assert.equal(checkpoints.at(-1)?.lifecycle?.host?.respawnRemainingMs, 3000)

  scene.time.now += 3000
  intervalCallback?.()
  await nextTurn()
  await nextTurn()

  assert.equal(scene.localPlayer.dead, false)
  assert.equal(scene.localPlayer.state.hp, 50)
  checkpoints = socket.calls
    .filter((call) => call.action === 'dungeon.fact' && call.params.fact?.type === 'session.checkpoint')
    .map((call) => call.params.fact.checkpoint)
  assert.equal(checkpoints.at(-1)?.lifecycle?.host?.status, 'alive')
  runtime.stop()
})
