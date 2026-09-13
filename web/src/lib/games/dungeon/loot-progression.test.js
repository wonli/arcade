import test from 'node:test'
import assert from 'node:assert/strict'
import { bossReward, rollEquipment } from './combat.js'
import { AFFIXES } from './affixes.js'

const sequence = (values) => { let index = 0; return () => values[index++ % values.length] }

test('deep floors materially improve the chance of seeing high rarity equipment', () => {
  const low = rollEquipment(1, sequence([0.30, 0.5, 0.5, 0.5]))
  const deep = rollEquipment(30, sequence([0.30, 0.8, 0.5, 0.4, 0.6, 0.3, 0.7]))
  assert.equal(low, null)
  assert.ok(deep)
  assert.ok(['rare', 'epic'].includes(deep.rarity))
})

test('boss reward damage scales with floor and keeps a build-defining affix', () => {
  const early = bossReward(sequence([0.1, 0.4, 0.2, 0.6, 0.3, 0.7]), 5)
  const deep = bossReward(sequence([0.1, 0.4, 0.2, 0.6, 0.3, 0.7]), 30)
  assert.equal(early.rarity, 'rare')
  assert.ok(deep.damage >= early.damage + 25)
  assert.ok(deep.affixes.some((entry) => AFFIXES[entry.id].category === 'build'))
})

test('deep bosses become increasingly likely to pay out epic weapons', () => {
  const early = bossReward(sequence([0.6, 0.5, 0.4, 0.3, 0.2, 0.1]), 5)
  const deep = bossReward(sequence([0.6, 0.5, 0.4, 0.3, 0.2, 0.1]), 30)
  assert.equal(early.rarity, 'rare')
  assert.equal(deep.rarity, 'epic')
})
