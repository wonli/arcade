import test from 'node:test'
import assert from 'node:assert/strict'
import { installDungeonEditorRuntime } from './editor-runtime.js'

function fakeScene() {
  const calls = { floor: 0, ai: 0, hit: 0, damage: 0, refresh: 0, sync: 0 }
  const scene = {
    enemies: [],
    playerState: { x: 100, y: 100, hp: 100, maxHp: 100, damage: 10 },
    time: { now: 0 },
    checkFloorClear() { calls.floor++ },
    updateEnemies() { calls.ai++ },
    hitPlayer() { calls.hit++ },
    damageEnemy(enemy, damage) {
      calls.damage++
      enemy.hp = Math.max(0, enemy.hp - damage)
      if (enemy.hp <= 0) this.killEnemy(enemy)
    },
    killEnemy(enemy) { enemy.killed = true },
    updateHealthBar() {},
    clearEnemies() { this.enemies = [] },
    clearEnemyProjectiles() {},
    clearDrops() {},
    spawnEnemy() {
      const enemy = {
        x: 0,
        y: 0,
        hp: 10,
        maxHp: 10,
        visual: { setPosition(x, y) { this.x = x; this.y = y } },
        healthBar: {},
        barOffset: 20,
      }
      this.enemies.push(enemy)
      return enemy
    },
    __dungeonSpatial: {
      refreshRoom() { calls.refresh++ },
      getGeometry() { return { id: 1 } },
    },
    __dungeonWeaponVisuals: { sync() { calls.sync++ } },
    events: { once() {} },
  }
  return { scene, calls }
}

test('sandbox disables floor progression', () => {
  const { scene, calls } = fakeScene()
  installDungeonEditorRuntime(scene)
  scene.checkFloorClear()
  assert.equal(calls.floor, 0)
})

test('can place a real spawned enemy at a chosen point', () => {
  const { scene } = fakeScene()
  const runtime = installDungeonEditorRuntime(scene)
  const enemy = runtime.spawnEnemyAt(44, 55)
  assert.equal(scene.enemies[0], enemy)
  assert.deepEqual([enemy.x, enemy.y], [44, 55])
  assert.deepEqual([enemy.visual.x, enemy.visual.y], [44, 55])
})

test('manual placement relocates a monster out of solid geometry', () => {
  const { scene } = fakeScene()
  scene.__roomGeometry = {
    width: 200,
    height: 200,
    solids: [{ x: 40, y: 40, width: 40, height: 40, kind: 'wall' }],
    water: [],
    bridges: [],
    spawnPoints: [{ x: 120, y: 120 }],
    spawn: { x: 20, y: 20 },
  }
  const runtime = installDungeonEditorRuntime(scene)
  const enemy = runtime.spawnEnemyAt(50, 50)
  assert.notDeepEqual([enemy.x, enemy.y], [50, 50])
  assert.deepEqual([enemy.visual.x, enemy.visual.y], [enemy.x, enemy.y])
})

test('AI can be paused and resumed', () => {
  const { scene, calls } = fakeScene()
  const runtime = installDungeonEditorRuntime(scene)
  runtime.setAiEnabled(false)
  scene.updateEnemies(1, 0.016)
  assert.equal(calls.ai, 0)
  runtime.setAiEnabled(true)
  scene.updateEnemies(1, 0.016)
  assert.equal(calls.ai, 1)
})

test('player and enemies can be made invincible without replacing entities', () => {
  const { scene, calls } = fakeScene()
  const runtime = installDungeonEditorRuntime(scene)
  const enemy = scene.spawnEnemy()
  runtime.setPlayerInvincible(true)
  scene.hitPlayer(9)
  assert.equal(calls.hit, 0)
  runtime.setEnemyInvincible(true)
  scene.damageEnemy(enemy, 99)
  assert.equal(enemy.hp, 10)
  assert.equal(enemy.killed, undefined)
  assert.equal(calls.damage, 1)
})

test('equip weapon uses the real equipment derivation and refreshes visuals', () => {
  const { scene, calls } = fakeScene()
  const runtime = installDungeonEditorRuntime(scene)
  runtime.equipWeapon({ type: 'weapon.kings_ruin', rarity: 'legendary', archetype: 'sword', damage: 7, affixes: [] })
  assert.equal(scene.playerState.weapon, 'weapon.kings_ruin')
  assert.equal(scene.playerState.weaponRarity, 'legendary')
  assert.equal(scene.playerState.damage, 17)
  assert.equal(calls.sync, 1)
})
