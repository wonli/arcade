import test from 'node:test'
import assert from 'node:assert/strict'

import { encounterPlan, lootPromotionChance, progressSnapshot, scalePlayerForProgress } from './infinite-runtime.js'

test('encounter plans distinguish combat elite rest and boss rooms', () => {
  assert.equal(encounterPlan({ floor: 1, chapter: 1, roomRole: 'combat' }).kind, 'combat')
  assert.equal(encounterPlan({ floor: 3, chapter: 1, roomRole: 'elite' }).kind, 'elite')
  assert.equal(encounterPlan({ floor: 4, chapter: 1, roomRole: 'rest' }).kind, 'rest')
  assert.equal(encounterPlan({ floor: 5, chapter: 1, roomRole: 'boss' }).kind, 'boss')
})

test('deep encounter plans keep enemy counts bounded', () => {
  const plan = encounterPlan({ floor: 80, chapter: 14, roomRole: 'elite' })
  assert.ok(plan.count <= 14)
  assert.ok(plan.eliteCount <= 5)
})

test('loot quality improves gradually with depth and fortune without becoming automatic', () => {
  assert.equal(lootPromotionChance(1, false), 0)
  assert.ok(lootPromotionChance(20, false) > 0)
  assert.ok(lootPromotionChance(20, true) > lootPromotionChance(20, false))
  assert.ok(lootPromotionChance(80, true) < 1)
})

test('progress snapshot is synchronous runtime state including room role and fortune flags', () => {
  const progress = {
    floor: 5,
    chapter: 1,
    chapterFloor: 5,
    chapterPlan: ['combat', 'elite', 'rest', 'antechamber', 'boss'],
  }
  assert.deepEqual(progressSnapshot(progress, true, false), {
    ...progress,
    roomRole: 'boss',
    fortunePending: true,
    fortuneActive: false,
  })
})

test('player runtime baseline follows floor progression without compounding twice on one floor', () => {
  const scene = {
    playerState: {
      hp: 100,
      maxHp: 100,
      damage: 10,
      critChance: 0.18,
      speed: 190,
      baseStats: { damage: 10, critChance: 0.18, speed: 190, maxHp: 100 },
      equippedWeapon: null,
    },
  }
  scalePlayerForProgress(scene, { floor: 1, chapter: 1 })
  assert.equal(scene.playerState.maxHp, 100)
  assert.equal(scene.playerState.damage, 10)

  scalePlayerForProgress(scene, { floor: 20, chapter: 4 })
  const deep = { maxHp: scene.playerState.maxHp, damage: scene.playerState.damage }
  assert.ok(deep.maxHp >= 270)
  assert.ok(deep.damage >= 30)
  assert.equal(scene.playerState.hp, deep.maxHp)

  scalePlayerForProgress(scene, { floor: 20, chapter: 4 })
  assert.equal(scene.playerState.maxHp, deep.maxHp)
  assert.equal(scene.playerState.damage, deep.damage)

  scene.playerState.baseStats = { ...scene.playerState.baseStats, damage: scene.playerState.baseStats.damage + 1 }
  scene.playerState.damage += 1
  scalePlayerForProgress(scene, { floor: 21, chapter: 4 })
  assert.equal(scene.playerState.damage, 33)
  scalePlayerForProgress(scene, { floor: 22, chapter: 4 })
  assert.equal(scene.playerState.damage, 34)
})
