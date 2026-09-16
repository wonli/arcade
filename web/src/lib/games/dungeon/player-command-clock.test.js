import test from 'node:test'
import assert from 'node:assert/strict'

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
    equipment: { weapon: null },
    modifiers: {},
  }
}

function commandScene() {
  const scene = { players: new Map(), enemies: [], time: { now: 12 } }
  const player = attachPlayerEntity(scene, { id: 'guest', state: state(40) })
  return { scene, player }
}

function networkScene() {
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
    time: { now: 12 },
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
  attachLocalPlayerEntity(scene, { id: 'host', state: state(10) })
  return scene
}

function socketFixture() {
  return {
    async request() { return { ok: true } },
    subscribe() { return () => {} },
  }
}

function roomMessage(payload) {
  return { data: { topicId: 'room:ABC123', message: payload } }
}

test('authoritative attack ignores sender timestamp and uses the injected gameplay clock', () => {
  const { scene, player } = commandScene()
  let observedTime = null
  scene.autoAttack = (time, attacker) => {
    observedTime = time
    attacker.lastAttackAt = time
  }

  const result = executePlayerCommand(
    scene,
    { type: 'attack', playerId: 'guest', time: 999999 },
    { authoritative: true, now: () => 4200 },
  )

  assert.equal(result.applied, true)
  assert.equal(observedTime, 4200)
  assert.equal(player.lastAttackAt, 4200)
})

test('authoritative skill cooldown is anchored to the injected gameplay clock', () => {
  const { scene, player } = commandScene()

  const result = executePlayerCommand(
    scene,
    { type: 'skill', playerId: 'guest', skillId: 'primary', time: 999999 },
    { authoritative: true, now: () => 5000 },
  )

  assert.equal(result.applied, true)
  assert.ok(player.skillReadyAt > 5000)
  assert.ok(player.skillReadyAt < 999999)
})

test('network authority executes remote command on its monotonic clock rather than sender or Phaser time', () => {
  const scene = networkScene()
  scene.autoAttack = (time, attacker) => { attacker.lastAttackAt = time }
  const runtime = createDungeonNetworkRuntime({
    socket: socketFixture(),
    scene,
    roomId: 'ABC123',
    localPlayerId: 'host',
    hostId: 'host',
    now: () => 7300,
  })

  runtime.handleMessage(roomMessage({
    type: 'dungeon.snapshot',
    playerId: 'guest',
    snapshot: { id: 'guest', state: state(100) },
  }))
  runtime.handleMessage(roomMessage({
    type: 'dungeon.command',
    playerId: 'guest',
    command: { type: 'attack', time: 999999 },
  }))

  assert.equal(scene.time.now, 12)
  assert.equal(scene.players.get('guest')?.lastAttackAt, 7300)
})
