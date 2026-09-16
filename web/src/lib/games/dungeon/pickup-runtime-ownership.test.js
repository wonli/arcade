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
    textures: { exists: () => true },
    tweens: { killTweensOf() {} },
    input: { keyboard: { addKey: () => ({ on() {}, off() {} }) } },
    events: { on() {}, off() {}, once() {} },
    emitStats() {},
    spawnDrop(x, y, item) { this.drops.push({ x, y, item }) },
    destroyDrop(drop) { drop?.visual?.destroy?.() },
    updateDrops() {},
    clearDrops() { this.drops = [] },
  })
}

function selectedWeaponVisual() {
  return {
    destroyed: false,
    scaleX: 1,
    scaleY: 1,
    setY() { return this },
    setScale() { return this },
    setTexture() {
      if (this.destroyed) throw new Error('setTexture called after destroy')
      return this
    },
    destroy() { this.destroyed = true },
  }
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

test('authoritative destruction clears selected weapon state before its Phaser visual is destroyed', () => {
  const scene = sceneFixture()
  installPickupInteraction(scene)
  const visual = selectedWeaponVisual()
  const drop = {
    id: 'drop:ABC123:1:0',
    x: 0,
    y: 0,
    spawnedAt: 0,
    groundY: 0,
    baseScaleX: 1,
    baseScaleY: 1,
    visual,
    item: { type: 'weapon.iron_fang', rarity: 'rare', damage: 12, affixes: [] },
  }
  scene.drops = [drop]

  scene.updateDrops(scene.localPlayer)
  assert.equal(visual.destroyed, false)

  scene.destroyDrop(drop)
  scene.drops = []

  assert.equal(visual.destroyed, true)
  assert.doesNotThrow(() => scene.updateDrops(scene.localPlayer))
})

test('pickup runtime owns authoritative removal by stable drop id', () => {
  const scene = sceneFixture()
  const interaction = installPickupInteraction(scene)
  const visual = selectedWeaponVisual()
  const drop = {
    id: 'drop:ABC123:1:7',
    x: 0,
    y: 0,
    visual,
    item: { type: 'weapon.iron_fang', rarity: 'rare', damage: 12, affixes: [] },
  }
  scene.drops = [drop]

  assert.equal(typeof interaction.removeById, 'function')
  assert.equal(interaction.removeById(drop.id), drop)
  assert.deepEqual(scene.drops, [])
  assert.equal(visual.destroyed, true)
})

test('missing named weapon art is reconciled after its texture becomes available', () => {
  const scene = sceneFixture()
  let textureReady = false
  scene.textures.exists = () => textureReady
  scene.add = {
    image(x, y, key) {
      return {
        x, y, key,
        scaleX: 1,
        scaleY: 1,
        setOrigin() { return this },
        setScale(value) { this.scaleX = value; this.scaleY = value; return this },
        setDepth() { return this },
        setY(value) { this.y = value; return this },
        destroy() { this.destroyed = true },
      }
    },
  }
  const interaction = installPickupInteraction(scene)
  const drop = interaction.spawnExact(30, 40, {
    type: 'weapon.iron_fang',
    rarity: 'rare',
    damage: 12,
    affixes: [],
  })

  assert.ok(drop)
  assert.equal(drop.visual, undefined)

  textureReady = true
  assert.equal(typeof interaction.reconcileVisuals, 'function')
  interaction.reconcileVisuals()

  assert.ok(drop.visual)
  assert.equal(drop.visual.destroyed, undefined)
})
