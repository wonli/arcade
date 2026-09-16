import test from 'node:test'
import assert from 'node:assert/strict'

import { createDungeonSessionRuntime, createSessionCheckpoint } from './session-runtime.js'

test('session runtime consumes portable gameplay durations while checkpoint state is parked', () => {
  let now = 5000
  const runtime = createDungeonSessionRuntime({ now: () => now })
  const checkpoint = createSessionCheckpoint({
    roomId: 'ABC123',
    runSeed: 'ABC123',
    authority: { epoch: 1, authorityId: 'host', sequence: 4 },
    status: 'playing',
    world: {
      type: 'world.state',
      floor: 3,
      enemies: [{
        id: 'enemy:ABC123:3:0',
        hp: 80,
        nextChargeRemainingMs: 4000,
        nextProjectileRemainingMs: 1250,
        nextSpecialRemainingMs: 1800,
      }],
      drops: [],
      portal: null,
    },
    players: {
      host: {
        id: 'host',
        state: { x: 10, y: 20, hp: 100, maxHp: 100, hasteRemainingMs: 1200 },
        lastAttackElapsedMs: 400,
        lastContactElapsedMs: 200,
        skillCooldownRemainingMs: { primary: 3000 },
      },
    },
    lifecycle: {
      host: { status: 'alive', respawnRemainingMs: 0, invulnerabilityRemainingMs: 0 },
    },
    openedChestIds: [],
  })

  assert.equal(runtime.applyCheckpoint(checkpoint), true)
  now = 6200

  const current = runtime.snapshot()
  assert.equal(current.players.host.lastAttackElapsedMs, 1600)
  assert.equal(current.players.host.lastContactElapsedMs, 1400)
  assert.deepEqual(current.players.host.skillCooldownRemainingMs, { primary: 1800 })
  assert.equal(current.players.host.state.hasteRemainingMs, 0)
  assert.equal(current.world.enemies[0].nextChargeRemainingMs, 2800)
  assert.equal(current.world.enemies[0].nextProjectileRemainingMs, 50)
  assert.equal(current.world.enemies[0].nextSpecialRemainingMs, 600)
})

test('authority takeover carries already-consumed gameplay durations without restarting them', () => {
  let now = 10000
  const runtime = createDungeonSessionRuntime({ now: () => now })
  runtime.applyCheckpoint(createSessionCheckpoint({
    roomId: 'ABC123',
    runSeed: 'ABC123',
    authority: { epoch: 1, authorityId: 'host', sequence: 9 },
    status: 'playing',
    world: {
      type: 'world.state',
      floor: 4,
      enemies: [{ id: 'enemy:ABC123:4:0', hp: 90, nextChargeRemainingMs: 3000 }],
      drops: [],
      portal: null,
    },
    players: {
      host: {
        id: 'host',
        state: { x: 10, y: 20, hp: 100, maxHp: 100 },
        lastAttackElapsedMs: 250,
        skillCooldownRemainingMs: { primary: 2200 },
      },
    },
    lifecycle: {
      host: { status: 'alive', respawnRemainingMs: 0, invulnerabilityRemainingMs: 0 },
    },
    openedChestIds: [],
  }))

  now = 10800
  const takeover = runtime.takeAuthority('guest')

  assert.equal(takeover.players.host.lastAttackElapsedMs, 1050)
  assert.deepEqual(takeover.players.host.skillCooldownRemainingMs, { primary: 1400 })
  assert.equal(takeover.world.enemies[0].nextChargeRemainingMs, 2200)

  now = 11300
  const later = runtime.snapshot()
  assert.equal(later.players.host.lastAttackElapsedMs, 1550)
  assert.deepEqual(later.players.host.skillCooldownRemainingMs, { primary: 900 })
  assert.equal(later.world.enemies[0].nextChargeRemainingMs, 1700)
})
