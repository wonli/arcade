import test from 'node:test'
import assert from 'node:assert/strict'
import { initialDungeonStats, initialDungeonProgress } from './session.js'

test('restart state returns a fresh base run', () => {
  const stats = initialDungeonStats()
  const progress = initialDungeonProgress()
  assert.deepEqual(stats, { hp: 100, maxHp: 100, damage: 10, kills: 0, healthPotions: 0, weapon: null, weaponRarity: null, weaponDamage: 0, weaponAffixes: [] })
  assert.deepEqual(progress, { floor: 1, chapter: 1, chapterFloor: 1, chapterLength: 4, roomRole: 'combat', fortuneActive: false })
  assert.notEqual(initialDungeonStats(), stats)
  assert.notEqual(initialDungeonProgress(), progress)
})
