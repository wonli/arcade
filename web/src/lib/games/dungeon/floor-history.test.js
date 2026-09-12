import test from 'node:test'
import assert from 'node:assert/strict'
import { canRetreatFromFloor, restoreDropState, snapshotFloorState } from './floor-history.js'

test('retreat is allowed before combat changes and after room clear', () => {
  assert.equal(canRetreatFromFloor({ floorCleared: false, floorKills: 0, enemies: [{ hp: 20, maxHp: 20 }] }), true)
  assert.equal(canRetreatFromFloor({ floorCleared: false, floorKills: 0, enemies: [{ hp: 19, maxHp: 20 }] }), false)
  assert.equal(canRetreatFromFloor({ floorCleared: false, floorKills: 1, enemies: [] }), false)
  assert.equal(canRetreatFromFloor({ floorCleared: true, floorKills: 4, enemies: [] }), true)
})

test('snapshot preserves geometry, chest state, drops and progress without retaining references', () => {
  const progress = { floor: 7, chapter: 2, roomRole: 'combat' }
  const geometry = { seed: 42, spawn: { x: 10, y: 20 } }
  const item = { type: 'weapon.dungeon_blade', rarity: 'rare', damage: 33, affixes: [{ id: 'power', value: 0.2 }] }
  const scene = { floorCleared: true, floorKills: 5, drops: [{ x: 80, y: 90, item }] }
  const spatial = { getGeometry: () => geometry, getChests: () => [{ id: 'chest-0', opened: true }] }
  const state = snapshotFloorState(scene, progress, spatial, { fortuneActive: true })
  assert.deepEqual(state.progress, progress)
  assert.deepEqual(state.geometry, geometry)
  assert.deepEqual(state.chests, [{ id: 'chest-0', opened: true }])
  assert.equal(state.drops[0].item.damage, 33)
  assert.equal(state.cleared, true)
  assert.equal(state.fortuneActive, true)
  geometry.seed = 99
  item.damage = 1
  assert.equal(state.geometry.seed, 42)
  assert.equal(state.drops[0].item.damage, 33)
})

test('restoring drops prefers exact pickup spawning over the progression wrapper', () => {
  const calls = []
  const scene = {
    spawnDrop() { throw new Error('progression wrapper must be bypassed') },
    __dungeonPickupRuntime: { spawnExact(x, y, item) { calls.push({ x, y, item }) } },
  }
  restoreDropState(scene, [{ x: 4, y: 8, item: { type: 'weapon.dungeon_blade', damage: 27, affixes: [] } }])
  assert.equal(calls.length, 1)
  assert.equal(calls[0].item.damage, 27)
})
