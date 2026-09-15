import test from 'node:test'
import assert from 'node:assert/strict'

import { PlayerEntity } from './player-entity.js'
import { installPickupInteraction, installPlayerInventoryRuntime } from './pickup-runtime.js'
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

test('player inventory runtime is separate from the scene pickup interaction', () => {
  const scene = sceneFixture()
  const interaction = installPickupInteraction(scene)

  assert.ok(scene.localPlayer.runtime.inventory)
  assert.notEqual(scene.localPlayer.runtime.inventory, interaction)
  assert.equal(interaction.inventory, scene.localPlayer.runtime.inventory)
  assert.equal(scene.__dungeonPickupRuntime, interaction)
})

test('multiple players can own inventory runtimes without installing another pickup interaction', () => {
  const scene = sceneFixture()
  const interaction = installPickupInteraction(scene)
  const remote = new PlayerEntity({
    id: 'remote',
    state: { x: 20, y: 20, hp: 100, maxHp: 100, healthPotions: 2 },
  })

  const remoteInventory = installPlayerInventoryRuntime(scene, remote)

  assert.notEqual(remoteInventory, scene.localPlayer.runtime.inventory)
  assert.equal(remote.runtime.inventory, remoteInventory)
  assert.equal(scene.__dungeonPickupRuntime, interaction)
  assert.equal(remoteInventory.getHealthPotions(), 2)
})

test('pickup intent interception keeps automatic drops untouched until authority confirms them', () => {
  const scene = sceneFixture()
  scene.localPlayer.state.hp = 40
  const interaction = installPickupInteraction(scene)
  const drop = {
    id: 'drop:ABC123:1:0',
    x: 0,
    y: 0,
    item: { type: 'consumable.health_potion', rarity: 'common', healRatio: 0.30 },
  }
  const intents = []
  scene.drops = [drop]
  interaction.setPickupIntentHandler((player, candidate) => {
    intents.push({ player, candidate })
    return true
  })

  scene.updateDrops(scene.localPlayer)

  assert.equal(scene.localPlayer.state.hp, 40)
  assert.equal(scene.localPlayer.state.healthPotions, 0)
  assert.deepEqual(scene.drops, [drop])
  assert.equal(intents.length, 1)
  assert.equal(intents[0].player, scene.localPlayer)
  assert.equal(intents[0].candidate, drop)
})
