import test from 'node:test'
import assert from 'node:assert/strict'

import { encounterPlan, lootPromotionChance, progressSnapshot } from './infinite-runtime.js'

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
