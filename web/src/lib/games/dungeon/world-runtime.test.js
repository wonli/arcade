import test from 'node:test'
import assert from 'node:assert/strict'

import { attachLocalPlayerEntity } from './player-entity.js'
import { createDungeonWorldRuntime, stableWorldEntityId } from './world-runtime.js'

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

function enemyFixture({ x = 120, archetype = 'skeleton', hp = 30 } = {}) {
  return {
    id: 'temporary',
    x,
    y: 140,
    hp,
    maxHp: 30,
    speed: 50,
    hitUntil: 0,
    archetype,
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
    contactDamage: 8,
    tint: null,
    scale: 1,
    barOffset: 28,
    visual: visual(archetype),
    healthBar: { destroyed: false },
  }
}

function sceneFixture(enemyOptions = {}) {
  const scene = {
    floor: 1,
    kills: 0,
    floorKills: 0,
    floorCleared: false,
    runComplete: false,
    enemies: [enemyFixture(enemyOptions)],
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
      const enemy = enemyFixture({ x: 500 + index * 10, archetype: options.elite ? 'brute' : 'fast' })
      enemy.elite = Boolean(options.elite)
      this.enemies.push(enemy)
      return enemy
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

test('stable world ids are derived only from run seed, floor, kind, and index', () => {
  assert.equal(stableWorldEntityId('abc123', 2, 'enemy', 4), 'enemy:ABC123:2:4')
  assert.equal(stableWorldEntityId(' ABC123 ', 2, 'enemy', 4), 'enemy:ABC123:2:4')
})

test('host world bootstrap publishes canonical enemy and drop state', () => {
  const scene = sceneFixture({ x: 222, archetype: 'ranged', hp: 19 })
  scene.drops.push({ x: 300, y: 320, item: { type: 'consumable.health_potion', healRatio: 0.3 }, visual: visual('drop') })
  const facts = []
  const runtime = createDungeonWorldRuntime(scene, {
    runSeed: 'ABC123',
    isHost: true,
    publishFact(fact) { facts.push(fact) },
  })
  runtime.start()

  const state = runtime.publishState()

  assert.equal(state.type, 'world.state')
  assert.equal(state.enemies[0].id, 'enemy:ABC123:1:0')
  assert.equal(state.enemies[0].x, 222)
  assert.equal(state.enemies[0].archetype, 'ranged')
  assert.equal(state.drops[0].entityId, 'drop:ABC123:1:0')
  assert.deepEqual(facts.at(-1), state)
})

test('guest world bootstrap replaces its random enemy state with the host state', () => {
  const host = sceneFixture({ x: 222, archetype: 'ranged', hp: 19 })
  const hostRuntime = createDungeonWorldRuntime(host, { runSeed: 'ABC123', isHost: true, publishFact() {} })
  hostRuntime.start()
  const state = hostRuntime.publishState()

  const guest = sceneFixture({ x: 700, archetype: 'skeleton', hp: 30 })
  const guestRuntime = createDungeonWorldRuntime(guest, { runSeed: 'ABC123', isHost: false })
  guestRuntime.start()
  const applied = guestRuntime.applyFact({ ...state, runSeed: 'ABC123', sequence: 1 })

  assert.equal(applied.type, 'world.state')
  assert.equal(guest.enemies.length, 1)
  assert.equal(guest.enemies[0].id, 'enemy:ABC123:1:0')
  assert.equal(guest.enemies[0].x, 222)
  assert.equal(guest.enemies[0].hp, 19)
  assert.equal(guest.enemies[0].archetype, 'ranged')
  assert.equal(guest.enemies[0].visual.type, 'ranged')
})
