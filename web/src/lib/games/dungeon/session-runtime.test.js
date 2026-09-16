import test from 'node:test'
import assert from 'node:assert/strict'

import { createPlayerEntity } from './player-entity.js'
import { serializePlayerSnapshot } from './player-snapshot.js'
import {
  createDungeonSessionRuntime,
  createSessionCheckpoint,
} from './session-runtime.js'

function playerSnapshot(id, x, { hp = 100, potions = 2 } = {}) {
  const player = createPlayerEntity({
    id,
    state: {
      x,
      y: 180,
      hp,
      maxHp: 100,
      damage: 18,
      healthPotions: potions,
      equipment: {
        weapon: {
          type: 'weapon.void_edge',
          archetype: 'sword',
          rarity: 'epic',
          damage: 14,
          affixes: [{ id: 'crit', value: 0.25 }],
        },
      },
      modifiers: { equipment: { attackSpeed: 0.15 } },
    },
  })
  player.actor = { phaser: true }
  player.runtime.weaponVisuals = { phaser: true }
  return serializePlayerSnapshot(player)
}

function checkpoint(overrides = {}) {
  return createSessionCheckpoint({
    roomId: 'ABC123',
    runSeed: 'ABC123',
    authority: { epoch: 1, authorityId: 'p1', sequence: 7 },
    status: 'playing',
    world: {
      type: 'world.state',
      floor: 9,
      enemies: [{ id: 'boss:1', hp: 420, maxHp: 1000 }],
      drops: [],
      portal: null,
    },
    players: {
      p1: playerSnapshot('p1', 120),
      p2: playerSnapshot('p2', 240, { hp: 0, potions: 4 }),
    },
    lifecycle: {
      p1: { status: 'alive', respawnRemainingMs: 0, invulnerabilityRemainingMs: 0 },
      p2: { status: 'downed', respawnRemainingMs: 3000, invulnerabilityRemainingMs: 0 },
    },
    openedChestIds: ['chest:ABC123:9:0'],
    ...overrides,
  })
}

test('checkpoint preserves durable build, world, chest and lifecycle state', () => {
  const value = checkpoint()

  assert.equal(value.world.floor, 9)
  assert.equal(value.players.p2.state.healthPotions, 4)
  assert.equal(value.players.p2.state.equipment.weapon.type, 'weapon.void_edge')
  assert.deepEqual(value.players.p2.state.equipment.weapon.affixes, [{ id: 'crit', value: 0.25 }])
  assert.deepEqual(value.openedChestIds, ['chest:ABC123:9:0'])
  assert.equal(value.lifecycle.p2.status, 'downed')
  assert.equal(JSON.parse(JSON.stringify(value)).world.enemies[0].id, 'boss:1')
})

test('checkpoint owns deep copies and cannot retain Phaser/runtime objects through player snapshots', () => {
  const p1 = playerSnapshot('p1', 120)
  const value = checkpoint({ players: { p1, p2: playerSnapshot('p2', 240) } })

  value.players.p1.state.equipment.weapon.affixes.push({ id: 'poison', value: 1 })
  assert.deepEqual(p1.state.equipment.weapon.affixes, [{ id: 'crit', value: 0.25 }])
  assert.equal('actor' in value.players.p1, false)
  assert.equal('runtime' in value.players.p1, false)
})

test('session accepts newer checkpoint and ignores stale same-epoch checkpoint', () => {
  let now = 1000
  const runtime = createDungeonSessionRuntime({ now: () => now })
  const current = checkpoint()
  const stale = checkpoint({
    authority: { epoch: 1, authorityId: 'p1', sequence: 6 },
    world: { type: 'world.state', floor: 2, enemies: [], drops: [], portal: null },
  })
  const newer = checkpoint({
    authority: { epoch: 1, authorityId: 'p1', sequence: 8 },
    world: { type: 'world.state', floor: 10, enemies: [], drops: [], portal: null },
  })

  assert.equal(runtime.applyCheckpoint(current), true)
  assert.equal(runtime.applyCheckpoint(stale), false)
  assert.equal(runtime.snapshot().world.floor, 9)
  assert.equal(runtime.applyCheckpoint(newer), true)
  assert.equal(runtime.snapshot().world.floor, 10)
})

test('newer authority epoch replaces old checkpoint even with reset sequence', () => {
  const runtime = createDungeonSessionRuntime({ now: () => 0 })
  assert.equal(runtime.applyCheckpoint(checkpoint()), true)

  const takeover = checkpoint({
    authority: { epoch: 2, authorityId: 'p2', sequence: 0 },
    world: { type: 'world.state', floor: 9, enemies: [{ id: 'boss:1', hp: 300 }], drops: [], portal: null },
  })
  assert.equal(runtime.applyCheckpoint(takeover), true)
  assert.deepEqual(runtime.snapshot().authority, { epoch: 2, authorityId: 'p2', sequence: 0 })
})

test('local monotonic elapsed time consumes remaining lifecycle timers', () => {
  let now = 5000
  const runtime = createDungeonSessionRuntime({ now: () => now })
  runtime.applyCheckpoint(checkpoint())

  now = 6200
  const current = runtime.snapshot()
  assert.equal(current.lifecycle.p2.respawnRemainingMs, 1800)
  assert.equal(current.lifecycle.p1.respawnRemainingMs, 0)
})

test('authority takeover carries consumed timer remainder instead of restarting it', () => {
  let now = 10000
  const runtime = createDungeonSessionRuntime({ now: () => now })
  runtime.applyCheckpoint(checkpoint())

  now = 11200
  const takeover = runtime.takeAuthority('p2')

  assert.deepEqual(takeover.authority, { epoch: 2, authorityId: 'p2', sequence: 0 })
  assert.equal(takeover.lifecycle.p2.respawnRemainingMs, 1800)
  assert.equal(runtime.snapshot().lifecycle.p2.respawnRemainingMs, 1800)
})

test('checkpoint JSON round-trip is stable and normalized', () => {
  const value = checkpoint({ openedChestIds: ['b', 'a', 'b'] })
  const roundTrip = createSessionCheckpoint(JSON.parse(JSON.stringify(value)))

  assert.deepEqual(roundTrip, value)
  assert.deepEqual(roundTrip.openedChestIds, ['a', 'b'])
})

test('invalid checkpoints are rejected before becoming session state', () => {
  const runtime = createDungeonSessionRuntime({ now: () => 0 })
  assert.throws(() => createSessionCheckpoint({ roomId: '', runSeed: 'A' }), /room/i)
  assert.throws(() => createSessionCheckpoint({ roomId: 'A', runSeed: '' }), /seed/i)
  assert.equal(runtime.applyCheckpoint(null), false)
})
