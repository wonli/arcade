import assert from 'node:assert/strict'
import test from 'node:test'

import { installDungeonPlayerInteractions } from './player-interaction-runtime.js'

function visual() {
  return {
    active: true,
    setVisible() { return this },
    setFrame() { return this },
    setAlpha() { return this },
  }
}

test('remote player can open a nearby chest through the shared player interaction runtime', () => {
  const spawned = []
  const chest = {
    id: 'chest-0', x: 100, y: 100, opened: false,
    visuals: { lock: visual(), sprite: visual(), glow: visual(), lid: visual() },
  }
  const scene = {
    floor: 2,
    __dungeonSpatial: { getChests: () => [chest] },
    __dungeonEnvironmentOpenFrames: { chest: 7 },
    time: { delayedCall(_ms, fn) { fn() } },
    tweens: { add() {} },
    spawnDrop(x, y, item) { spawned.push({ x, y, item }) },
    events: { once() {} },
  }
  const runtime = installDungeonPlayerInteractions(scene, {
    getProgress: () => ({ floor: 2, chapter: 1, roomRole: 'combat', fortuneActive: false }),
    random: () => 0.5,
  })

  assert.equal(runtime.interactPlayer({ id: 'p2', state: { x: 112, y: 100 } }), true)
  assert.equal(chest.opened, true)
  assert.equal(spawned.length, 1)
  assert.equal(spawned[0].item.type, 'weapon.dungeon_blade')
})

test('authoritative chest snapshot opens guest visual without duplicating loot', () => {
  let spawned = 0
  const chest = {
    id: 'chest-0', x: 100, y: 100, opened: false,
    visuals: { lock: visual(), sprite: visual(), glow: visual(), lid: visual() },
  }
  const scene = {
    __dungeonSpatial: { getChests: () => [chest] },
    __dungeonEnvironmentOpenFrames: { chest: 7 },
    time: { delayedCall(_ms, fn) { fn() } },
    tweens: { add() {} },
    spawnDrop() { spawned++ },
    events: { once() {} },
  }
  const runtime = installDungeonPlayerInteractions(scene)

  runtime.applySnapshot([{ id: 'chest-0', opened: true }])
  assert.equal(chest.opened, true)
  assert.equal(spawned, 0)
})
