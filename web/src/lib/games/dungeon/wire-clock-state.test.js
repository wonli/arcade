import test from 'node:test'
import assert from 'node:assert/strict'

import {
  captureWireFactClockState,
  captureWirePlayerClockState,
  materializeWireFactClockState,
  materializeWirePlayerClockState,
} from './wire-clock-state.js'

function playerSnapshot() {
  return {
    id: 'guest',
    state: {
      x: 10,
      y: 20,
      hp: 100,
      maxHp: 100,
      equipment: { weapon: null },
      modifiers: {},
      hasteUntil: 11200,
    },
    lastAttackAt: 9600,
    lastContactAt: 9800,
    skillCooldowns: { primary: 13000 },
  }
}

test('wire player snapshots contain portable gameplay durations instead of sender clock timestamps', () => {
  const wire = captureWirePlayerClockState(playerSnapshot(), 10000)

  assert.equal('lastAttackAt' in wire, false)
  assert.equal('lastContactAt' in wire, false)
  assert.equal('skillCooldowns' in wire, false)
  assert.equal('hasteUntil' in wire.state, false)
  assert.equal(wire.lastAttackElapsedMs, 400)
  assert.equal(wire.lastContactElapsedMs, 200)
  assert.deepEqual(wire.skillCooldownRemainingMs, { primary: 3000 })
  assert.equal(wire.state.hasteRemainingMs, 1200)

  const local = materializeWirePlayerClockState(wire, 250)
  assert.equal(local.lastAttackAt, -150)
  assert.equal(local.lastContactAt, 50)
  assert.deepEqual(local.skillCooldowns, { primary: 3250 })
  assert.equal(local.state.hasteUntil, 1450)
})

test('world.state facts use portable enemy gameplay durations on the wire', () => {
  const fact = {
    type: 'world.state',
    floor: 3,
    enemies: [{
      id: 'enemy:ABC123:3:0',
      hp: 80,
      nextChargeAt: 14000,
      nextShockwaveAt: 15500,
      chargingUntil: 10600,
      nextProjectileAt: 11250,
      nextSpecialAt: 11800,
      dashUntil: 10400,
      specialLockedUntil: 10750,
    }],
  }

  const wire = captureWireFactClockState(fact, 10000)
  const enemy = wire.enemies[0]
  for (const field of [
    'nextChargeAt',
    'nextShockwaveAt',
    'chargingUntil',
    'nextProjectileAt',
    'nextSpecialAt',
    'dashUntil',
    'specialLockedUntil',
  ]) {
    assert.equal(field in enemy, false)
  }
  assert.equal(enemy.nextChargeRemainingMs, 4000)
  assert.equal(enemy.nextShockwaveRemainingMs, 5500)
  assert.equal(enemy.chargingRemainingMs, 600)
  assert.equal(enemy.nextProjectileRemainingMs, 1250)
  assert.equal(enemy.nextSpecialRemainingMs, 1800)
  assert.equal(enemy.dashRemainingMs, 400)
  assert.equal(enemy.specialLockedRemainingMs, 750)

  const local = materializeWireFactClockState(wire, 250)
  assert.equal(local.enemies[0].nextChargeAt, 4250)
  assert.equal(local.enemies[0].nextShockwaveAt, 5750)
  assert.equal(local.enemies[0].chargingUntil, 850)
})

test('drop.pickup facts make nested player state portable without touching non-clock payload', () => {
  const fact = {
    type: 'drop.pickup',
    entityId: 'drop:ABC123:3:0',
    playerId: 'guest',
    player: playerSnapshot(),
  }

  const wire = captureWireFactClockState(fact, 10000)
  assert.equal(wire.entityId, fact.entityId)
  assert.equal(wire.playerId, 'guest')
  assert.equal('lastAttackAt' in wire.player, false)
  assert.equal(wire.player.lastAttackElapsedMs, 400)

  const local = materializeWireFactClockState(wire, 250)
  assert.equal(local.player.lastAttackAt, -150)
  assert.equal(local.player.state.hasteUntil, 1450)
})
