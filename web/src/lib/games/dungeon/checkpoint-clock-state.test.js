import test from 'node:test'
import assert from 'node:assert/strict'

import {
  captureCheckpointClockState,
  consumeCheckpointClockState,
  materializeCheckpointClockState,
} from './checkpoint-clock-state.js'

function checkpointFixture() {
  return {
    world: {
      floor: 3,
      enemies: [{
        id: 'enemy:ABC123:3:0',
        hp: 80,
        hitUntil: 10090,
        nextChargeAt: 14000,
        nextShockwaveAt: 15500,
        chargingUntil: 10600,
        nextProjectileAt: 11250,
        nextSpecialAt: 11800,
        dashUntil: 10400,
        specialLockedUntil: 10750,
        pendingSpecial: {
          type: 'brute_slam',
          resolveAt: 10420,
          targetId: 'p1',
          x: 120,
          y: 180,
          radius: 82,
          damage: 18,
        },
      }],
    },
    players: {
      p1: {
        id: 'p1',
        state: {
          x: 120,
          y: 180,
          hp: 75,
          hasteUntil: 11200,
        },
        lastAttackAt: 9600,
        lastContactAt: 9800,
        skillCooldowns: {
          primary: 13000,
          dash: 10000,
        },
      },
    },
  }
}

test('checkpoint capture converts browser-local gameplay timestamps into portable durations', () => {
  const captured = captureCheckpointClockState(checkpointFixture(), 10000)
  const player = captured.players.p1
  const enemy = captured.world.enemies[0]

  assert.equal('lastAttackAt' in player, false)
  assert.equal('lastContactAt' in player, false)
  assert.equal('skillCooldowns' in player, false)
  assert.equal('hasteUntil' in player.state, false)
  assert.equal(player.lastAttackElapsedMs, 400)
  assert.equal(player.lastContactElapsedMs, 200)
  assert.deepEqual(player.skillCooldownRemainingMs, { primary: 3000, dash: 0 })
  assert.equal(player.state.hasteRemainingMs, 1200)

  assert.equal('nextChargeAt' in enemy, false)
  assert.equal('nextShockwaveAt' in enemy, false)
  assert.equal('chargingUntil' in enemy, false)
  assert.equal('nextProjectileAt' in enemy, false)
  assert.equal('nextSpecialAt' in enemy, false)
  assert.equal('dashUntil' in enemy, false)
  assert.equal('specialLockedUntil' in enemy, false)
  assert.equal(enemy.nextChargeRemainingMs, 4000)
  assert.equal(enemy.nextShockwaveRemainingMs, 5500)
  assert.equal(enemy.chargingRemainingMs, 600)
  assert.equal(enemy.nextProjectileRemainingMs, 1250)
  assert.equal(enemy.nextSpecialRemainingMs, 1800)
  assert.equal(enemy.dashRemainingMs, 400)
  assert.equal(enemy.specialLockedRemainingMs, 750)
  assert.equal('resolveAt' in enemy.pendingSpecial, false)
  assert.equal(enemy.pendingSpecial.resolveRemainingMs, 420)
  assert.equal(enemy.pendingSpecial.targetId, 'p1')

  // Presentation-only timing is deliberately outside the gameplay clock contract.
  assert.equal(enemy.hitUntil, 10090)
})

test('checkpoint durations age while stored without depending on a browser clock epoch', () => {
  const captured = captureCheckpointClockState(checkpointFixture(), 10000)
  const aged = consumeCheckpointClockState(captured, 300)
  const player = aged.players.p1
  const enemy = aged.world.enemies[0]

  assert.equal(player.lastAttackElapsedMs, 700)
  assert.equal(player.lastContactElapsedMs, 500)
  assert.deepEqual(player.skillCooldownRemainingMs, { primary: 2700, dash: 0 })
  assert.equal(player.state.hasteRemainingMs, 900)
  assert.equal(enemy.nextChargeRemainingMs, 3700)
  assert.equal(enemy.nextShockwaveRemainingMs, 5200)
  assert.equal(enemy.chargingRemainingMs, 300)
  assert.equal(enemy.nextProjectileRemainingMs, 950)
  assert.equal(enemy.nextSpecialRemainingMs, 1500)
  assert.equal(enemy.dashRemainingMs, 100)
  assert.equal(enemy.specialLockedRemainingMs, 450)
  assert.equal(enemy.pendingSpecial.resolveRemainingMs, 120)

  // Capture is immutable so SessionRuntime can materialize repeatedly from one observation point.
  assert.equal(captured.players.p1.lastAttackElapsedMs, 400)
  assert.equal(captured.world.enemies[0].nextChargeRemainingMs, 4000)
  assert.equal(captured.world.enemies[0].pendingSpecial.resolveRemainingMs, 420)
})

test('materialization re-anchors portable durations onto the receiving gameplay clock', () => {
  const captured = captureCheckpointClockState(checkpointFixture(), 10000)
  const aged = consumeCheckpointClockState(captured, 300)
  const materialized = materializeCheckpointClockState(aged, 250)
  const player = materialized.players.p1
  const enemy = materialized.world.enemies[0]

  assert.equal(player.lastAttackAt, -450)
  assert.equal(player.lastContactAt, -250)
  assert.deepEqual(player.skillCooldowns, { primary: 2950, dash: 0 })
  assert.equal(player.state.hasteUntil, 1150)
  assert.equal(enemy.nextChargeAt, 3950)
  assert.equal(enemy.nextShockwaveAt, 5450)
  assert.equal(enemy.chargingUntil, 550)
  assert.equal(enemy.nextProjectileAt, 1200)
  assert.equal(enemy.nextSpecialAt, 1750)
  assert.equal(enemy.dashUntil, 350)
  assert.equal(enemy.specialLockedUntil, 700)
  assert.equal(enemy.pendingSpecial.resolveAt, 370)
  assert.equal('resolveRemainingMs' in enemy.pendingSpecial, false)

  assert.equal('lastAttackElapsedMs' in player, false)
  assert.equal('skillCooldownRemainingMs' in player, false)
  assert.equal('hasteRemainingMs' in player.state, false)
  assert.equal('nextChargeRemainingMs' in enemy, false)
})
