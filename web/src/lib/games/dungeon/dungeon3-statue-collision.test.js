import test from 'node:test'
import assert from 'node:assert/strict'
import { generateDungeonGeometry } from './map-generator.js'
import * as infiniteRuntime from './infinite-runtime.js'

test('ordinary generated rooms never place Statue_fire as a map obstacle', () => {
  for (let seed = 1; seed <= 40; seed++) {
    for (let floor = 1; floor <= 3; floor++) {
      const g = generateDungeonGeometry({ runSeed: seed, floor })
      const statues = g.decorations.filter((entry) => entry.kind === 'statue')
      assert.equal(statues.length, 0, `seed ${seed}/${floor}: Statue_fire leaked into an ordinary room`)
    }
  }
})

test('rest Statue_fire is a complete 5x5 visual landmark centered on the campfire anchor', () => {
  assert.equal(typeof infiniteRuntime.restStatuePlan, 'function', 'rest room must expose the visual statue plan')
  const anchor = { x: 320, y: 240 }
  const tiles = infiniteRuntime.restStatuePlan(anchor)
  assert.equal(tiles.length, 25, 'rest landmark must keep the complete Statue_fire 5x5 assembly')
  assert.deepEqual([...new Set(tiles.map((tile) => tile.tileset))], ['Statue_fire'])
  assert.deepEqual([Math.min(...tiles.map((tile) => tile.x)), Math.max(...tiles.map((tile) => tile.x))], [anchor.x - 32, anchor.x + 32])
  assert.deepEqual([Math.min(...tiles.map((tile) => tile.y)), Math.max(...tiles.map((tile) => tile.y))], [anchor.y - 32, anchor.y + 32])
  assert.ok(tiles.every((tile) => tile.blocking == null && tile.collision == null && tile.solid == null),
    'rest landmark is render-only and must never participate in collision')
})
