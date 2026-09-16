import test from 'node:test'
import assert from 'node:assert/strict'

import { attachLocalPlayerEntity } from './player-entity.js'
import { createDungeonWorldRuntime } from './world-runtime.js'

function visual(type = 'skeleton') {
  return {
    type,
    scaleX: 1,
    scaleY: 1,
    destroyed: false,
    setDepth() { return this },
    setScale(x, y) { this.scaleX = x; this.scaleY = y; return this },
    setTint() { return this },
    setPosition(x, y) { this.x = x; this.y = y; return this },
    setVisible(value) { this.visible = value; return this },
    destroy() { this.destroyed = true },
  }
}

function enemyFixture(pendingSpecial = null) {
  return {
    id: 'temporary',
    x: 120,
    y: 140,
    hp: 30,
    maxHp: 30,
    speed: 50,
    hitUntil: 0,
    archetype: 'brute',
    elite: false,
    boss: false,
    phase: 1,
    phaseThreshold: 0.5,
    chargeCooldown: 0,
    shockwaveCooldown: 0,
    nextChargeAt: 2600,
    nextShockwaveAt: 3600,
    chargingUntil: 0,
    chargeVx: 0,
    chargeVy: 0,
    attackRange: 0,
    preferredRange: 0,
    projectileDamage: 0,
    projectileCooldown: 0,
    projectileSpeed: 0,
    nextProjectileAt: 1800,
    nextSpecialAt: 3200,
    dashUntil: 1310,
    dashVx: 118,
    dashVy: -24,
    specialLockedUntil: 1420,
    strafeSign: -1,
    contactDamage: 8,
    tint: null,
    scale: 1,
    barOffset: 28,
    pendingSpecial: structuredClone(pendingSpecial),
    visual: visual('brute'),
    healthBar: { destroyed: false },
  }
}

function sceneFixture(pendingSpecial = null) {
  const scene = {
    floor: 1,
    kills: 0,
    floorKills: 0,
    floorCleared: false,
    runComplete: false,
    enemies: [enemyFixture(pendingSpecial)],
    drops: [],
    players: new Map(),
    portal: null,
    time: { now: 1000 },
    updateHealthBar() {},
    syncPlayerAnimation() {},
    destroyHealthBar(bar) { if (bar) bar.destroyed = true },
    createHealthBar() { return { destroyed: false } },
    makeActor(x, y, kind, type) {
      const actor = visual(type)
      actor.x = x
      actor.y = y
      return actor
    },
    spawnEnemy(index, options = {}) {
      const enemy = enemyFixture(null)
      enemy.x = 500 + index * 10
      enemy.elite = Boolean(options.elite)
      this.enemies.push(enemy)
      return enemy
    },
    damageEnemy(enemy, damage) {
      if (!enemy || enemy.hp <= 0) return null
      enemy.hp = Math.max(0, enemy.hp - damage)
      return enemy.hp
    },
    spawnDrop(x, y, item) {
      const drop = { x, y, item: structuredClone(item), visual: visual('drop') }
      this.drops.push(drop)
      return drop
    },
    destroyDrop(drop) { drop?.visual?.destroy?.() },
    clearDrops() {
      for (const drop of this.drops) this.destroyDrop(drop)
      this.drops = []
    },
    updateDrops() {},
    openPortal() { this.portal = { x: 480, y: 518 } },
    destroyPortal() { this.portal = null },
    advanceFloor() { this.floor++ },
  }

  attachLocalPlayerEntity(scene, {
    id: 'local',
    state: { x: 100, y: 100, hp: 100, maxHp: 100, equipment: { weapon: null }, modifiers: {} },
  })
  return scene
}

function bruteSlam() {
  return {
    type: 'brute_slam',
    resolveAt: 1420,
    targetId: 'local',
    x: 120,
    y: 140,
    radius: 82,
    damage: 12,
  }
}

test('world state carries detached enemy behavior timing and pending special state', () => {
  const pending = bruteSlam()
  const scene = sceneFixture(pending)
  const runtime = createDungeonWorldRuntime(scene, {
    runSeed: 'ABC123',
    isHost: true,
    publishFact() {},
  })
  runtime.start()

  const state = runtime.publishState()

  assert.equal(state.enemies[0].nextSpecialAt, 3200)
  assert.equal(state.enemies[0].dashUntil, 1310)
  assert.equal(state.enemies[0].dashVx, 118)
  assert.equal(state.enemies[0].dashVy, -24)
  assert.equal(state.enemies[0].specialLockedUntil, 1420)
  assert.equal(state.enemies[0].strafeSign, -1)
  assert.deepEqual(state.enemies[0].pendingSpecial, pending)
  state.enemies[0].pendingSpecial.damage = 999
  assert.equal(scene.enemies[0].pendingSpecial.damage, 12)
})

test('world state replaces and clears follower pending enemy special without sharing snapshot state', () => {
  const pending = bruteSlam()
  const host = sceneFixture(pending)
  const hostRuntime = createDungeonWorldRuntime(host, {
    runSeed: 'ABC123',
    isHost: true,
    publishFact() {},
  })
  hostRuntime.start()
  const activeState = hostRuntime.publishState()

  const guest = sceneFixture({ ...bruteSlam(), damage: 99, resolveAt: 9999 })
  guest.enemies[0].nextSpecialAt = 9999
  guest.enemies[0].dashUntil = 9999
  guest.enemies[0].dashVx = 999
  guest.enemies[0].dashVy = 999
  guest.enemies[0].specialLockedUntil = 9999
  guest.enemies[0].strafeSign = 1
  const guestRuntime = createDungeonWorldRuntime(guest, {
    runSeed: 'ABC123',
    isHost: false,
  })
  guestRuntime.start()
  guestRuntime.applyFact({ ...activeState, runSeed: 'ABC123', sequence: 1 })

  assert.equal(guest.enemies[0].nextSpecialAt, 3200)
  assert.equal(guest.enemies[0].dashUntil, 1310)
  assert.equal(guest.enemies[0].dashVx, 118)
  assert.equal(guest.enemies[0].dashVy, -24)
  assert.equal(guest.enemies[0].specialLockedUntil, 1420)
  assert.equal(guest.enemies[0].strafeSign, -1)
  assert.deepEqual(guest.enemies[0].pendingSpecial, pending)
  guest.enemies[0].pendingSpecial.damage = 777
  assert.equal(activeState.enemies[0].pendingSpecial.damage, 12)

  host.enemies[0].pendingSpecial = null
  const clearedState = hostRuntime.publishState()
  guestRuntime.applyFact({ ...clearedState, runSeed: 'ABC123', sequence: 2 })

  assert.equal(guest.enemies[0].pendingSpecial, null)
})
