import test from 'node:test'
import assert from 'node:assert/strict'

import { ensureDungeonLootRuntime } from './loot-runtime.js'
import { attachLocalPlayerEntity } from './player-entity.js'
import { createDungeonNetworkRuntime } from './network-runtime.js'
import { currentWeapon } from './player-loadout.js'

function weapon(type = 'weapon.sword', damage = 17) {
  return { type, rarity: 'rare', damage, affixes: [] }
}

function state(x = 0, y = 20, equipped = null) {
  return {
    x,
    y,
    hp: 100,
    maxHp: 100,
    damage: 10,
    critChance: 0,
    healthPotions: 0,
    equipment: { weapon: equipped },
    modifiers: {},
  }
}

function textNode() {
  return {
    text: '',
    x: 0,
    y: 0,
    destroyed: false,
    setOrigin() { return this },
    setDepth() { return this },
    setText(value) { this.text = String(value); return this },
    setPosition(x, y) { this.x = x; this.y = y; return this },
    destroy() { this.destroyed = true },
  }
}

function sceneFixture(localId = 'host', localState = state(10)) {
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
  const local = attachLocalPlayerEntity(scene, { id: localId, state: localState })
  local.actor = scene.makeActor(localState.x, localState.y)
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

function checkpoint({ guestState, drops = [] } = {}) {
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
      drops,
      portal: null,
    },
    players: guestState ? { guest: { id: 'guest', state: guestState } } : {},
    lifecycle: guestState ? { guest: { status: 'alive' } } : {},
    openedChestIds: [],
  }
}

test('reconnect sync request never overwrites the authority copy of the guest loadout before checkpoint capture', async () => {
  const scene = sceneFixture('host')
  const socket = socketFixture()
  const runtime = createDungeonNetworkRuntime({
    socket,
    scene,
    roomId: 'ABC123',
    localPlayerId: 'host',
    hostId: 'host',
    setIntervalImpl: () => 1,
    clearIntervalImpl: () => {},
  })
  runtime.start()
  await nextTurn()
  socket.calls.length = 0

  runtime.handleMessage(roomMessage({
    type: 'dungeon.snapshot',
    playerId: 'guest',
    snapshot: { id: 'guest', state: state(120, 20, weapon('weapon.katana', 31)) },
  }))
  assert.equal(currentWeapon(scene.players.get('guest').state)?.type, 'weapon.katana')

  runtime.handleMessage(roomMessage({
    type: 'dungeon.snapshot',
    playerId: 'guest',
    snapshot: { id: 'guest', state: state(10, 20, null), syncCheckpoint: true },
  }))
  await nextTurn()
  await nextTurn()

  assert.equal(scene.players.get('guest').state.x, 120)
  assert.equal(currentWeapon(scene.players.get('guest').state)?.type, 'weapon.katana')

  const fact = socket.calls
    .filter((call) => call.action === 'dungeon.fact')
    .map((call) => call.params.fact)
    .find((candidate) => candidate?.type === 'session.checkpoint')
  assert.equal(fact?.checkpoint?.players?.guest?.state?.x, 120)
  assert.equal(fact?.checkpoint?.players?.guest?.state?.equipment?.weapon?.type, 'weapon.katana')
  runtime.stop()
})

test('fresh follower stays snapshot-silent until checkpoint hydration then restores local weapon and ground presentation', async () => {
  const scene = sceneFixture('guest', state(10, 20, null))
  const socket = socketFixture()
  let tick = null
  let weaponSyncs = 0
  let groundReconciles = 0

  scene.localPlayer.runtime.weaponVisuals = { sync() { weaponSyncs++ } }
  const loot = ensureDungeonLootRuntime(scene)
  loot.setSpawnOwner((request) => {
    const drop = { id: null, x: request.x, y: request.y, item: structuredClone(request.item), visual: null }
    scene.drops.push(drop)
    return drop
  })
  scene.__dungeonPickupRuntime = {
    setPickupIntentHandler() { return null },
    set pickupById(value) { this._pickupById = value },
    get pickupById() { return this._pickupById },
    reconcileVisuals() { groundReconciles++ },
  }

  const runtime = createDungeonNetworkRuntime({
    socket,
    scene,
    roomId: 'ABC123',
    localPlayerId: 'guest',
    hostId: 'host',
    setIntervalImpl(callback) { tick = callback; return 1 },
    clearIntervalImpl: () => {},
  })
  runtime.start()
  await nextTurn()

  assert.equal(socket.calls.filter((call) => call.action === 'dungeon.snapshot').length, 1)
  assert.equal(socket.calls.find((call) => call.action === 'dungeon.snapshot')?.params.snapshot.syncCheckpoint, true)

  tick()
  await nextTurn()
  assert.equal(socket.calls.filter((call) => call.action === 'dungeon.snapshot').length, 1)

  runtime.handleMessage(roomMessage({
    type: 'dungeon.fact',
    playerId: 'host',
    fact: {
      type: 'session.checkpoint',
      checkpoint: checkpoint({
        guestState: state(180, 40, weapon('weapon.spear', 27)),
        drops: [{ entityId: 'drop:ABC123:1:0', x: 260, y: 90, item: weapon('weapon.axe', 24) }],
      }),
    },
  }))

  assert.equal(scene.localPlayer.state.x, 180)
  assert.equal(currentWeapon(scene.localPlayer.state)?.type, 'weapon.spear')
  assert.equal(scene.drops.length, 1)
  assert.equal(scene.drops[0].item.type, 'weapon.axe')
  assert.equal(weaponSyncs, 1)
  assert.equal(groundReconciles, 1)

  tick()
  await nextTurn()
  const snapshots = socket.calls.filter((call) => call.action === 'dungeon.snapshot')
  assert.equal(snapshots.length, 2)
  assert.equal('syncCheckpoint' in snapshots[1].params.snapshot, false)
  assert.equal(snapshots[1].params.snapshot.state.equipment.weapon.type, 'weapon.spear')
  runtime.stop()
})

test('host portal countdown uses both live player positions and restarts from three after either player leaves', () => {
  const scene = sceneFixture('host', state(100, 100))
  const socket = socketFixture()
  scene.portal = { id: 'portal:ABC123:1:0', x: 100, y: 100, unlockAt: 0, countdownLabel: null }

  const runtime = createDungeonNetworkRuntime({
    socket,
    scene,
    roomId: 'ABC123',
    localPlayerId: 'host',
    hostId: 'host',
    setIntervalImpl: () => 1,
    clearIntervalImpl: () => {},
  })
  runtime.start()

  runtime.handleMessage(roomMessage({
    type: 'dungeon.snapshot',
    playerId: 'guest',
    snapshot: { id: 'guest', state: state(220, 100) },
  }))
  scene.updatePortal(1000)
  assert.equal(scene.portal.countdownLabel, null)

  runtime.handleMessage(roomMessage({
    type: 'dungeon.snapshot',
    playerId: 'guest',
    snapshot: { id: 'guest', state: state(104, 100) },
  }))
  scene.updatePortal(1100)
  assert.equal(scene.portal.countdownLabel?.text, '3')

  runtime.handleMessage(roomMessage({
    type: 'dungeon.snapshot',
    playerId: 'guest',
    snapshot: { id: 'guest', state: state(220, 100) },
  }))
  scene.updatePortal(1800)
  assert.equal(scene.portal.countdownLabel, null)

  runtime.handleMessage(roomMessage({
    type: 'dungeon.snapshot',
    playerId: 'guest',
    snapshot: { id: 'guest', state: state(104, 100) },
  }))
  scene.updatePortal(1900)
  assert.equal(scene.portal.countdownLabel?.text, '3')
  runtime.stop()
})
