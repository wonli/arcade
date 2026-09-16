import test from 'node:test'
import assert from 'node:assert/strict'

import {
  COOP_INVULNERABILITY_MS,
  COOP_RESPAWN_MS,
  createCoopLifecycle,
  downPlayer,
  advanceCoopLifecycle,
} from './coop-lifecycle.js'
import { installCoopLifecycleRuntime } from './coop-lifecycle-runtime.js'

function players() {
  return {
    p1: { id: 'p1', state: { x: 100, y: 100, hp: 100, maxHp: 100, equipment: { weapon: { type: 'weapon.sword' } }, healthPotions: 2 }, dead: false },
    p2: { id: 'p2', state: { x: 150, y: 100, hp: 80, maxHp: 120, equipment: { weapon: { type: 'weapon.staff' } }, healthPotions: 3 }, dead: false },
  }
}

function sceneFixture() {
  const roster = players()
  let originalGameOvers = 0
  let originalHits = 0
  const scene = {
    players: new Map(Object.entries(roster)),
    localPlayer: roster.p1,
    time: { now: 1000 },
    __roomGeometry: null,
    gameOver() { originalGameOvers++ },
    hitPlayer(damage, player = this.localPlayer) {
      originalHits++
      player.state.hp = Math.max(0, player.state.hp - damage)
      if (player.state.hp <= 0) this.gameOver(player)
    },
    updateHealthBar() {},
    syncPlayerAnimation() {},
  }
  return { scene, roster, gameOvers: () => originalGameOvers, hits: () => originalHits }
}

test('one downed player starts a three-second respawn while the teammate stays alive', () => {
  let lifecycle = createCoopLifecycle(['p1', 'p2'])
  const result = downPlayer(lifecycle, 'p1')
  lifecycle = result.lifecycle
  assert.equal(result.partyWiped, false)
  assert.deepEqual(lifecycle.p1, { status: 'downed', respawnRemainingMs: COOP_RESPAWN_MS, invulnerabilityRemainingMs: 0 })
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
})

test('invulnerability counts down independently after revive', () => {
  let lifecycle = downPlayer(createCoopLifecycle(['p1', 'p2']), 'p1').lifecycle
  lifecycle = advanceCoopLifecycle(lifecycle, COOP_RESPAWN_MS).lifecycle
  const first = advanceCoopLifecycle(lifecycle, 1000)
  assert.equal(first.lifecycle.p1.invulnerabilityRemainingMs, 500)
  assert.equal(advanceCoopLifecycle(first.lifecycle, 500).lifecycle.p1.invulnerabilityRemainingMs, 0)
})

test('a revived player can be downed and revived repeatedly while teammate lives', () => {
  let lifecycle = createCoopLifecycle(['p1', 'p2'])
  lifecycle = downPlayer(lifecycle, 'p1').lifecycle
  lifecycle = advanceCoopLifecycle(lifecycle, COOP_RESPAWN_MS).lifecycle
  lifecycle = downPlayer(lifecycle, 'p1').lifecycle
  assert.equal(lifecycle.p1.respawnRemainingMs, COOP_RESPAWN_MS)
  assert.equal(downPlayer(lifecycle, 'p2').partyWiped, true)
})

test('scene runtime suppresses single-player game over while teammate lives and revives at half hp', () => {
  const { scene, roster, gameOvers } = sceneFixture()
  const runtime = installCoopLifecycleRuntime(scene, { isAuthority: () => true })
  const weapon = structuredClone(roster.p1.state.equipment.weapon)

  scene.hitPlayer(999, roster.p1)
  assert.equal(roster.p1.dead, true)
  assert.equal(gameOvers(), 0)

  runtime.tick(3000)
  assert.equal(roster.p1.dead, false)
  assert.equal(roster.p1.state.hp, 50)
  assert.deepEqual(roster.p1.state.equipment.weapon, weapon)
  assert.equal(roster.p1.state.healthPotions, 2)
})

test('scene runtime presents party wipe only after both players are downed', () => {
  const { scene, roster, gameOvers } = sceneFixture()
  installCoopLifecycleRuntime(scene, { isAuthority: () => true })

  scene.gameOver(roster.p1)
  assert.equal(gameOvers(), 0)
  scene.gameOver(roster.p2)
  assert.equal(gameOvers(), 1)
})

test('scene runtime blocks damage during post-respawn invulnerability', () => {
  const { scene, roster, hits } = sceneFixture()
  const runtime = installCoopLifecycleRuntime(scene, { isAuthority: () => true })
  scene.gameOver(roster.p1)
  runtime.tick(3000)
  const hp = roster.p1.state.hp

  scene.hitPlayer(20, roster.p1)
  assert.equal(roster.p1.state.hp, hp)
  assert.equal(hits(), 0)
  runtime.tick(1500)
  scene.hitPlayer(20, roster.p1)
  assert.equal(hits(), 1)
})

test('follower apply restores lifecycle without advancing timers locally', () => {
  const { scene, roster } = sceneFixture()
  const runtime = installCoopLifecycleRuntime(scene, { isAuthority: () => false })
  runtime.apply({
    p1: { status: 'downed', respawnRemainingMs: 1200, invulnerabilityRemainingMs: 0 },
    p2: { status: 'alive', respawnRemainingMs: 0, invulnerabilityRemainingMs: 0 },
  }, { status: 'playing' })

  runtime.tick(5000)
  assert.equal(roster.p1.dead, true)
  assert.equal(runtime.snapshot().p1.respawnRemainingMs, 1200)
})
