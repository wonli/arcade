import assert from 'node:assert/strict'
import test from 'node:test'

import { openChestForPlayer } from './coop-chest-runtime.js'

function makeScene() {
  const drops = []
  const chest = {
    id: 'chest-0',
    x: 120,
    y: 100,
    opened: false,
    visuals: {
      lock: { setVisible() {} },
      glow: { setAlpha() {} },
      lid: { y: 100 },
    },
  }
  return {
    floor: 3,
    drops,
    __dungeonSpatial: { getChests: () => [chest] },
    __dungeonEnvironmentOpenFrames: {},
    __dungeonVfx: { sparkle() {} },
    tweens: { add() {} },
    spawnDrop(x, y, item) { drops.push({ x, y, item }) },
    chest,
  }
}

test('same run seed and chest id produce the same authoritative loot', () => {
  const a = makeScene()
  const b = makeScene()
  const player = { id: 'p2', state: { x: 120, y: 100 } }
  const options = { runSeed: 'ABCDEF', floor: 3, progress: { chapter: 1, roomRole: 'combat' } }

  const first = openChestForPlayer(a, player, options)
  const second = openChestForPlayer(b, player, options)

  assert.deepEqual(first.drops, second.drops)
  assert.deepEqual(a.drops, b.drops)
  assert.equal(a.chest.opened, true)
  assert.equal(b.chest.opened, true)
})

test('opened chest cannot generate loot twice', () => {
  const scene = makeScene()
  const player = { id: 'p2', state: { x: 120, y: 100 } }
  const options = { runSeed: 'ABCDEF', floor: 3, progress: { chapter: 1, roomRole: 'combat' } }
  assert.ok(openChestForPlayer(scene, player, options))
  assert.equal(openChestForPlayer(scene, player, options), null)
  assert.equal(scene.drops.length, 1)
})
