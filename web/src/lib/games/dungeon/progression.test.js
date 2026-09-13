import test from 'node:test'
import assert from 'node:assert/strict'

import { advanceProgress, createChapterPlan, createRunProgress, difficultyProfile, playerProgressionProfile, roomRoleAt } from './progression.js'

function sequenceRandom(values) {
  let index = 0
  return () => values[index++ % values.length]
}

test('chapter plans are 4-8 floors with a boss last', () => {
  for (const value of [0, 0.24, 0.49, 0.74, 0.999]) {
    const plan = createChapterPlan(1, () => value)
    assert.ok(plan.length >= 4 && plan.length <= 8)
    assert.equal(plan.at(-1), 'boss')
  }
})

test('chapter plans contain at most one rest floor and keep it away from the edges', () => {
  for (let i = 0; i < 30; i++) {
    const plan = createChapterPlan(3, sequenceRandom([i / 30, 0.1, 0.8, 0.2, 0.6]))
    const rest = plan.map((role, index) => role === 'rest' ? index : -1).filter((index) => index >= 0)
    assert.ok(rest.length <= 1)
    if (rest.length) {
      assert.notEqual(rest[0], 0)
      assert.notEqual(rest[0], plan.length - 2)
    }
  }
})

test('progression increments absolute floor and rolls into a new chapter after boss', () => {
  const random = sequenceRandom([0, 0.9, 0.9, 0.9, 0.9])
  let progress = createRunProgress(random)
  assert.equal(progress.floor, 1)
  assert.equal(progress.chapter, 1)
  assert.equal(progress.chapterFloor, 1)

  const chapterLength = progress.chapterPlan.length
  for (let i = 1; i < chapterLength; i++) progress = advanceProgress(progress, random)
  assert.equal(roomRoleAt(progress), 'boss')
  const before = progress.floor
  progress = advanceProgress(progress, random)
  assert.equal(progress.floor, before + 1)
  assert.equal(progress.chapter, 2)
  assert.equal(progress.chapterFloor, 1)
})

test('difficulty scaling stays bounded on deep floors', () => {
  const deep = difficultyProfile({ floor: 80, chapter: 14, roomRole: 'elite' })
  assert.ok(deep.waveCount <= 14)
  assert.ok(deep.speedMultiplier <= 1.45)
  assert.ok(deep.hpMultiplier > 1)
  assert.ok(deep.damageMultiplier > 1)
  const combat = difficultyProfile({ floor: 20, chapter: 4, roomRole: 'combat' })
  const elite = difficultyProfile({ floor: 20, chapter: 4, roomRole: 'elite' })
  assert.ok(elite.hpMultiplier > combat.hpMultiplier)
  assert.ok(elite.damageMultiplier > combat.damageMultiplier)
})

test('player has meaningful power before the first chapter boss', () => {
  const floorFour = playerProgressionProfile({ floor: 4, chapter: 1 })
  const floorFive = playerProgressionProfile({ floor: 5, chapter: 1 })
  const floorEight = playerProgressionProfile({ floor: 8, chapter: 1 })
  assert.ok(floorFour.damageMultiplier >= 1.3)
  assert.ok(floorFive.damageMultiplier >= 1.4)
  assert.ok(floorFive.maxHpMultiplier >= 1.28)
  assert.ok(floorEight.damageMultiplier >= 1.7)
})

test('player baseline grows with floor but equipment still has room to matter', () => {
  const first = playerProgressionProfile({ floor: 1, chapter: 1 })
  const mid = playerProgressionProfile({ floor: 20, chapter: 4 })
  const deep = playerProgressionProfile({ floor: 80, chapter: 14 })
  assert.deepEqual(first, { maxHpMultiplier: 1, damageMultiplier: 1 })
  assert.ok(mid.maxHpMultiplier > 2.5)
  assert.ok(mid.damageMultiplier > 2)
  assert.ok(deep.maxHpMultiplier <= 4)
  assert.ok(deep.damageMultiplier <= 3.25)
  assert.ok(deep.maxHpMultiplier >= mid.maxHpMultiplier)
})
