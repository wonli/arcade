import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

import { createDungeonWorldRuntime, stableWorldEntityId } from './world-runtime.js'

const worldSource = await readFile(new URL('./world-runtime.js', import.meta.url), 'utf8')

function destroyable() {
  return {
    destroyed: 0,
    active: true,
    destroy() { this.destroyed++; this.active = false },
    setVisible() { return this },
    setPosition() { return this },
  }
}

function sceneFixture() {
  const visual = destroyable()
  const healthBar = destroyable()
  const eliteAura = destroyable()
  const enemy = {
    id: stableWorldEntityId('ABC123', 1, 'enemy', 0),
    x: 100,
    y: 120,
    hp: 80,
    maxHp: 80,
    barOffset: 28,
    elite: true,
    boss: false,
    archetype: 'skeleton',
    visual,
    healthBar,
    eliteAura,
  }
  const scene = {
    floor: 1,
    kills: 0,
    floorKills: 0,
    floorCleared: false,
    runComplete: false,
    enemies: [enemy],
    drops: [],
    players: new Map(),
    portal: null,
    time: { now: 1000 },
    updateHealthBar() {},
    destroyHealthBar(bar) { bar?.destroy?.() },
    deathBurst() {},
    clearDrops() { this.drops = [] },
  }
  return { scene, enemy, visual, healthBar, eliteAura }
}

test('world runtime owns enemy identity through EnemyRuntime instead of replacing Scene spawnEnemy', () => {
  assert.match(worldSource, /installDungeonEnemySceneBridge\(scene\)/)
  assert.match(worldSource, /enemies\.setObserver\(/)
  assert.match(worldSource, /enemies\.spawn\(index,/)
  assert.doesNotMatch(worldSource, /scene\.spawnEnemy\s*=/)
  assert.doesNotMatch(worldSource, /originals\.spawnEnemy/)
})

test('canonical world removal destroys the whole enemy presentation including elite aura', () => {
  const { scene, visual, healthBar, eliteAura } = sceneFixture()
  const runtime = createDungeonWorldRuntime(scene, { runSeed: 'ABC123', isHost: false })

  runtime.applyFact({
    type: 'world.state',
    runSeed: 'ABC123',
    sequence: 1,
    floor: 1,
    enemies: [],
    drops: [],
    portal: null,
  })

  assert.equal(visual.destroyed, 1)
  assert.equal(healthBar.destroyed, 1)
  assert.equal(eliteAura.destroyed, 1)
  assert.deepEqual(scene.enemies, [])
})

test('authoritative enemy death destroys aura together with sprite and health bar', () => {
  const { scene, enemy, visual, healthBar, eliteAura } = sceneFixture()
  const runtime = createDungeonWorldRuntime(scene, { runSeed: 'ABC123', isHost: false })

  runtime.applyFact({
    type: 'enemy.death',
    runSeed: 'ABC123',
    sequence: 1,
    entityId: enemy.id,
    x: enemy.x,
    y: enemy.y,
    kills: 1,
    floorKills: 1,
  })

  assert.equal(visual.destroyed, 1)
  assert.equal(healthBar.destroyed, 1)
  assert.equal(eliteAura.destroyed, 1)
  assert.deepEqual(scene.enemies, [])
})
