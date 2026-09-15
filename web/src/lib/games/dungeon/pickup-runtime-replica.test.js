import assert from 'node:assert/strict'
import test from 'node:test'

import { installPickupInteraction } from './pickup-runtime.js'

function sceneStub() {
  let down = null
  return {
    floor: 1,
    playerState: {
      x: 100,
      y: 100,
      hp: 100,
      maxHp: 100,
      damage: 10,
      healthPotions: 0,
      weapon: null,
      baseStats: { damage: 10, critChance: 0.18, speed: 190, maxHp: 100 },
    },
    drops: [],
    time: { now: 600 },
    input: { keyboard: { addKey: () => ({ on(_event, fn) { down = fn }, off() {} }) } },
    events: { once() {}, on() {}, off() {} },
    emitStats() {},
    updateHealthBar() {},
    pickupBurst() { throw new Error('replica must not apply pickup feedback before Host authority') },
    spawnDrop(x, y, item) {
      this.drops.push({
        x, y, item,
        visual: { scaleX: 1, scaleY: 1, setY() {}, setScale() {}, destroy() {} },
        glow: { setAlpha() {}, destroy() {} },
        label: { text: '', setText(value) { this.text = value }, destroy() {} },
        sparkles: [],
      })
    },
    destroyDrop() { throw new Error('replica must not destroy authoritative drops locally') },
    updateDrops() {},
    clearDrops() { this.drops = [] },
    __down: () => down?.(),
  }
}

test('replica keeps ground weapon selection UI but does not equip or remove the item', () => {
  const scene = sceneStub()
  let selection = null
  installPickupInteraction(scene, {
    authority: false,
    onSelection(next) { selection = next },
  })

  const item = { type: 'weapon.dungeon_blade', archetype: 'sword', rarity: 'rare', damage: 17, affixes: [] }
  scene.spawnDrop(100, 100, item)
  scene.updateDrops()

  assert.equal(scene.drops.length, 1)
  assert.equal(scene.playerState.weapon, null)
  assert.equal(selection?.candidate?.rarity, 'rare')

  scene.__down()
  assert.equal(scene.drops.length, 1)
  assert.equal(scene.playerState.weapon, null)
})

test('replica never auto-picks a nearby potion', () => {
  const scene = sceneStub()
  installPickupInteraction(scene, { authority: false })
  scene.spawnDrop(100, 100, { type: 'consumable.health_potion', rarity: 'common', heal: 28 })
  scene.updateDrops()
  assert.equal(scene.drops.length, 1)
  assert.equal(scene.playerState.healthPotions, 0)
})
