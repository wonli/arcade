import test from 'node:test'
import assert from 'node:assert/strict'

import { chestRewardProfile, nearestInteractable } from './interactables.js'

test('chest reward quality rises from combat to elite to boss', () => {
  const combat = chestRewardProfile('combat', 1, false)
  const elite = chestRewardProfile('elite', 1, false)
  const boss = chestRewardProfile('boss', 1, false)
  assert.ok(elite.quality > combat.quality)
  assert.ok(boss.quality > elite.quality)
  assert.ok(boss.dropCount >= elite.dropCount)
})

test('chapter depth and fortune improve quality without guaranteeing epic', () => {
  const shallow = chestRewardProfile('combat', 1, false)
  const deep = chestRewardProfile('combat', 12, false)
  const fortunate = chestRewardProfile('combat', 12, true)
  assert.ok(deep.quality > shallow.quality)
  assert.ok(fortunate.quality > deep.quality)
  assert.ok(fortunate.epicChance < 1)
})

test('nearest interactable picks the closest unopened object inside range', () => {
  const player = { x: 100, y: 100 }
  const interactables = [
    { id: 'opened', x: 103, y: 100, opened: true },
    { id: 'near', x: 125, y: 100, opened: false },
    { id: 'far', x: 160, y: 100, opened: false },
  ]
  assert.equal(nearestInteractable(player, interactables, 42)?.id, 'near')
  assert.equal(nearestInteractable(player, interactables, 20), null)
})
