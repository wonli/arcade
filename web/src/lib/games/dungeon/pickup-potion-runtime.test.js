import test from 'node:test'
import assert from 'node:assert/strict'

import { installPickupInteraction } from './pickup-runtime.js'
import { attachLegacyTestPlayer } from './test/player-fixture.js'

function sceneFixture(state) {
  const bursts = []
  const scene = attachLegacyTestPlayer({
    playerState: { x: 0, y: 0, healthPotions: 0, ...state },
    drops: [],
    time: { now: 0 },
    input: { keyboard: { addKey: () => ({ on() {}, off() {} }) } },
    events: { on() {}, off() {}, once() {} },
    emitStats() {},
    updateHealthBar() {},
    pickupBurst(x, y, item, healed) { bursts.push({ x, y, item, healed }) },
    destroyDrop(drop) { this.drops = this.drops.filter((entry) => entry !== drop) },
    spawnDrop(x, y, item) { this.drops.push({ x, y, item }) },
    updateDrops() {},
    clearDrops() { this.drops = [] },
  })
  return { scene, bursts }
}

test('pickup runtime consumes a ground potion to fully heal a damaged player', () => {
  const { scene, bursts } = sceneFixture({ hp: 40, maxHp: 100, healthPotions: 2 })
  installPickupInteraction(scene)
  scene.drops = [{ x: 0, y: 0, item: { type: 'consumable.health_potion', rarity: 'common' } }]

  scene.updateDrops(scene.localPlayer)

  assert.equal(scene.localPlayer.state.hp, 100)
  assert.equal(scene.localPlayer.state.healthPotions, 2)
  assert.equal(scene.drops.length, 0)
  assert.equal(bursts.at(-1)?.healed, 60)
})

test('pickup runtime stores a ground potion when the player is already full health', () => {
  const { scene, bursts } = sceneFixture({ hp: 100, maxHp: 100, healthPotions: 2 })
  installPickupInteraction(scene)
  scene.drops = [{ x: 0, y: 0, item: { type: 'consumable.health_potion', rarity: 'common' } }]

  scene.updateDrops(scene.localPlayer)

  assert.equal(scene.localPlayer.state.hp, 100)
  assert.equal(scene.localPlayer.state.healthPotions, 3)
  assert.equal(scene.drops.length, 0)
  assert.equal(bursts.at(-1)?.healed, 0)
})
