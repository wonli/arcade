import test from 'node:test'
import assert from 'node:assert/strict'

import { ensureDungeonLootRuntime } from './loot-runtime.js'
import { createDungeonWorldRuntime } from './world-runtime.js'

function sceneFixture() {
  const drop = {
    id: 'drop:ABC123:1:0',
    x: 120,
    y: 140,
    item: { type: 'weapon.iron_fang', rarity: 'rare', damage: 12, affixes: [] },
    visual: { destroyed: false, destroy() { this.destroyed = true } },
  }
  const removed = []
  const scene = {
    floor: 1,
    kills: 0,
    floorKills: 0,
    floorCleared: false,
    runComplete: false,
    enemies: [],
    drops: [drop],
    players: new Map(),
    portal: null,
    time: { now: 1000 },
    spawnDrop() {},
    destroyDrop(candidate) { candidate?.visual?.destroy?.() },
    clearDrops() { this.drops = [] },
    updateDrops() {},
    openPortal() {},
    advanceFloor() {},
  }
  const loot = ensureDungeonLootRuntime(scene)
  loot.setRemoveOwner((candidate, removeCore) => {
    removed.push(candidate.id)
    removeCore(candidate)
    return candidate
  })
  return { scene, drop, removed }
}

test('authoritative drop facts remove presentation only through the pickup lifecycle owner', () => {
  const { scene, drop, removed } = sceneFixture()
  const runtime = createDungeonWorldRuntime(scene, { runSeed: 'ABC123', isHost: false })

  runtime.applyFact({
    type: 'drop.pickup',
    runSeed: 'ABC123',
    sequence: 1,
    entityId: drop.id,
    playerId: 'remote',
  })

  assert.deepEqual(removed, [drop.id])
  assert.deepEqual(scene.drops, [])
  assert.equal(drop.visual.destroyed, true)
})
