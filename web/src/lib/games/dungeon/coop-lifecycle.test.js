import test from 'node:test'
import assert from 'node:assert/strict'

import {
  COOP_INVULNERABILITY_MS,
  COOP_RESPAWN_MS,
  createCoopLifecycle,
  downPlayer,
  advanceCoopLifecycle,
} from './coop-lifecycle.js'

function players() {
  return {
    p1: { state: { hp: 100, maxHp: 100, equipment: { weapon: { type: 'weapon.sword' } }, healthPotions: 2 } }, dead: false },
    p2: { state: { hp: 80, maxHp: 120, equipment: { weapon: { type: 'weapon.staff' } }, healthPotions: 3 } }, dead: false },
  }
}

test('one downed player starts a three-second respawn while the teammate stays alive', () => {
  const roster = players()
  let lifecycle = createCoopLifecycle(Object.keys(roster))

  const result = downPlayer(lifecycle, 'p1')
  lifecycle = result.lifecycle

  assert.equal(result.partyWiped, false)
  assert.deepEqual(lifecycle.p1, {
    status: 'downed',
    respawnRemainingMs: COOP_RESPAWN_MS,
    invulnerabilityRemainingMs: 0,
  })
  assert.equal(lifecycle.p2.status, 'alive')
})

test('downed timer does not revive early and reaches zero using elapsed duration', () => {
  let lifecycle = downPlayer(createCoopLifecycle(['p1', 'p2']), 'p1').lifecycle

  let advanced = advanceCoopLifecycle(lifecycle, 2999)
  assert.equal(advanced.lifecycle.p1.status, 'downed')
  assert.equal(advanced.lifecycle.p1.respawnRemainingMs, 1)
  assert.deepEqual(advanced.revived, [])

  advanced = advanceCoopLifecycle(advanced.lifecycle, 1)
  assert.equal(advanced.lifecycle.p1.status, 'alive')
  assert.equal(advanced.lifecycle.p1.respawnRemainingMs, 0)
  assert.equal(advanced.lifecycle.p1.invulnerabilityRemainingMs, COOP_INVULNERABILITY_MS)
  assert.deepEqual(advanced.revived, ['p1'])
})

test('both players downed means party wipe and no automatic revive', () => {
  let lifecycle = createCoopLifecycle(['p1', 'p2'])
  lifecycle = downPlayer(lifecycle, 'p1').lifecycle
  const second = downPlayer(lifecycle, 'p2')

  assert.equal(second.partyWiped, true)
  const advanced = advanceCoopLifecycle(second.lifecycle, 10000, { partyWiped: true })
  assert.deepEqual(advanced.revived, [])
  assert.equal(advanced.lifecycle.p1.status, 'downed')
  assert.equal(advanced.lifecycle.p2.status, 'downed')
})

test('invulnerability counts down independently after revive', () => {
  let lifecycle = downPlayer(createCoopLifecycle(['p1', 'p2']), 'p1').lifecycle
  lifecycle = advanceCoopLifecycle(lifecycle, COOP_RESPAWN_MS).lifecycle

  const first = advanceCoopLifecycle(lifecycle, 1000)
  assert.equal(first.lifecycle.p1.invulnerabilityRemainingMs, 500)
  const second = advanceCoopLifecycle(first.lifecycle, 500)
  assert.equal(second.lifecycle.p1.invulnerabilityRemainingMs, 0)
})

test('a revived player can be downed and revived repeatedly while teammate lives', () => {
  let lifecycle = createCoopLifecycle(['p1', 'p2'])
  lifecycle = downPlayer(lifecycle, 'p1').lifecycle
  lifecycle = advanceCoopLifecycle(lifecycle, COOP_RESPAWN_MS).lifecycle
  lifecycle = downPlayer(lifecycle, 'p1').lifecycle

  assert.equal(lifecycle.p1.status, 'downed')
  assert.equal(lifecycle.p1.respawnRemainingMs, COOP_RESPAWN_MS)
  assert.equal(downPlayer(lifecycle, 'p2').partyWiped, true)
})

test('respawn application restores half hp but preserves weapon and potions', () => {
  const roster = players()
  const originalWeapon = structuredClone(roster.p1.state.equipment.weapon)
  const originalPotions = roster.p1.state.healthPotions

  roster.p1.state.hp = 0
  roster.p1.dead = true
  roster.p1.state.hp = Math.max(1, Math.ceil(roster.p1.state.maxHp * 0.5))
  roster.p1.dead = false

  assert.equal(roster.p1.state.hp, 50)
  assert.deepEqual(roster.p1.state.equipment.weapon, originalWeapon)
  assert.equal(roster.p1.state.healthPotions, originalPotions)
})
