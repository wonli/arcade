import test from 'node:test'
import assert from 'node:assert/strict'

import { encounterPlan, lootPromotionChance, progressSnapshot, scalePlayerForProgress } from './infinite-runtime.js'

test('encounter plans distinguish combat elite rest and boss rooms', () => {
  assert.equal(encounterPlan({ floor: 3, chapter: 1, roomRole: 'rest' }).kind, 'rest')
  const combat = encounterPlan({ floor: 10, chapter: 2, roomRole: 'combat' })
  const elite = encounterPlan({ floor: 10, chapter: 2, roomRole: 'elite' })
  const boss = encounterPlan({ floor: 10, chapter: 2, roomRole: 'boss' })
  assert.equal(combat.kind, 'combat')
  assert.equal(elite.kind, 'elite')
  assert.ok(elite.count >= combat.count)
  assert.equal(boss.kind, 'boss')
  assert.equal(boss.bossCount, 1)
})

test('deep encounter plans keep enemy counts bounded', () => {
  const plan = encounterPlan({ floor: 200, chapter: 35, roomRole: 'elite' })
  assert.ok(plan.count <= 14)
})

test('loot quality improves gradually with depth and fortune without becoming automatic', () => {
  assert.equal(lootPromotionChance(1, false), 0)
  const deep = lootPromotionChance(30, false)
  assert.ok(deep > 0)
  assert.ok(deep <= 0.35)
  const fortunate = lootPromotionChance(30, true)
  assert.ok(fortunate > deep)
  assert.ok(fortunate < 0.8)
})

test('progress snapshot is synchronous runtime state including room role and fortune flags', () => {
  const progress = {
    floor: 9,
    chapter: 2,
    chapterFloor: 4,
    chapterLength: 5,
    chapterPlan: ['combat', 'elite', 'rest', 'combat', 'boss'],
  }
  assert.deepEqual(progressSnapshot(progress, true, false), {
    ...progress,
    roomRole: 'combat',
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
  assert.ok(deep.maxHp >= 170)
  assert.ok(deep.damage >= 13)
  assert.equal(scene.playerState.hp, deep.maxHp)

  scalePlayerForProgress(scene, { floor: 20, chapter: 4 })
  assert.equal(scene.playerState.maxHp, deep.maxHp)
  assert.equal(scene.playerState.damage, deep.damage)
})
