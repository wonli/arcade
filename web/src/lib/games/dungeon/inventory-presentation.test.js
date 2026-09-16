import test from 'node:test'
import assert from 'node:assert/strict'

import { syncLocalInventoryPresentation } from './inventory-presentation.js'

test('canonical local player inventory updates HUD potion count and stats', () => {
  const player = { state: { healthPotions: 4 } }
  const counts = []
  let stats = 0
  const scene = {
    localPlayer: player,
    __dungeonInventoryStats(value) { counts.push(value) },
    emitStats() { stats++ },
  }

  assert.equal(syncLocalInventoryPresentation(scene, player), true)
  assert.deepEqual(counts, [4])
  assert.equal(stats, 1)
})

test('remote player inventory never overwrites the local HUD', () => {
  const local = { state: { healthPotions: 1 } }
  const remote = { state: { healthPotions: 9 } }
  const counts = []
  const scene = {
    localPlayer: local,
    __dungeonInventoryStats(value) { counts.push(value) },
    emitStats() {},
  }

  assert.equal(syncLocalInventoryPresentation(scene, remote), false)
  assert.deepEqual(counts, [])
})