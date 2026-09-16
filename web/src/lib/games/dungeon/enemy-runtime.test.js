import test from 'node:test'
import assert from 'node:assert/strict'

import { ensureDungeonEnemyRuntime, installDungeonEnemySceneBridge } from './enemy-runtime.js'

function fixture() {
  const spawned = []
  const scene = {
    floor: 3,
    spawnEnemy(index = 0, options = {}) {
      const enemy = { index, options: { ...options }, floor: this.floor }
      spawned.push(enemy)
      return enemy
    },
  }
  return { scene, spawned }
}

test('enemy Scene bridge remains stable while observers are installed and restored', () => {
  const { scene } = fixture()
  const first = installDungeonEnemySceneBridge(scene)
  const spawnEnemy = scene.spawnEnemy
  const enemies = ensureDungeonEnemyRuntime(scene)
  const restore = enemies.setObserver({ onSpawned() {} })
  const second = installDungeonEnemySceneBridge(scene)

  assert.equal(second, first)
  assert.equal(scene.spawnEnemy, spawnEnemy)
  restore()
  assert.equal(scene.spawnEnemy, spawnEnemy)
})

test('enemy runtime preserves core spawn behavior and observes the created enemy', () => {
  const { scene, spawned } = fixture()
  installDungeonEnemySceneBridge(scene)
  const enemies = ensureDungeonEnemyRuntime(scene)
  const observed = []
  enemies.setObserver({
    onSpawned(event) {
      observed.push(event)
      event.enemy.id = `enemy:${scene.floor}:${event.index}`
    },
  })

  const enemy = scene.spawnEnemy(2, { elite: true })

  assert.equal(enemy, spawned[0])
  assert.equal(enemy.id, 'enemy:3:2')
  assert.deepEqual(enemy.options, { elite: true })
  assert.equal(observed.length, 1)
  assert.equal(observed[0].enemy, enemy)
  assert.equal(observed[0].index, 2)
  assert.deepEqual(observed[0].options, { elite: true })
})

test('enemy runtime does not invent an enemy when the Scene has no spawn implementation', () => {
  const scene = {}
  installDungeonEnemySceneBridge(scene)
  const enemies = ensureDungeonEnemyRuntime(scene)
  let observed = 0
  enemies.setObserver({ onSpawned() { observed++ } })

  assert.equal(scene.spawnEnemy(0), null)
  assert.equal(observed, 0)
})
