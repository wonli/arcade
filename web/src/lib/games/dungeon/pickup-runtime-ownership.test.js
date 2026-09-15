import test from 'node:test'
import assert from 'node:assert/strict'

import { installPickupInteraction } from './pickup-runtime.js'
import { attachLegacyTestPlayer } from './test/player-fixture.js'

function sceneFixture() {
  return attachLegacyTestPlayer({
    playerState: { x: 0, y: 0, hp: 100, maxHp: 100, healthPotions: 0 },
    drops: [],
    time: { now: 0 },
    input: { keyboard: { addKey: () => ({ on() {}, off() {} }) } },
    events: { on() {}, off() {}, once() {} },
    emitStats() {},
    spawnDrop(x, y, item) { this.drops.push({ x, y, item }) },
    updateDrops() {},
    clearDrops() { this.drops = [] },
  })
}

test('pickup runtime is owned by the player while scene keeps a compatibility alias', () => {
  const scene = sceneFixture()
  const runtime = installPickupInteraction(scene)

  assert.equal(scene.localPlayer.runtime.inventory, runtime)
  assert.equal(scene.__dungeonPickupRuntime, runtime)
})
