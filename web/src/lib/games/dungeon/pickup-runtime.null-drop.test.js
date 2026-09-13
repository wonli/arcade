import test from 'node:test'
import assert from 'node:assert/strict'
import { installPickupInteraction } from './pickup-runtime.js'

test('equipping never replaces the selected drop with null', () => {
  let onDown = null
  const candidate = {
    x: 0,
    y: 0,
    item: { type: 'weapon.dungeon_blade', archetype: 'sword', rarity: 'rare', damage: 12, affixes: [] },
    visual: { scaleX: 1, scaleY: 1, setY() {}, setScale() {} },
    glow: { setAlpha() {} },
    sparkles: [],
  }
  const scene = {
    floor: 1,
    playerState: { x: 0, y: 0, hp: 100, maxHp: 100, baseStats: { damage: 10, critChance: 0.18, speed: 190, maxHp: 100 } },
    drops: [candidate],
    time: { now: 0 },
    input: { keyboard: { addKey: () => ({ on(_event, fn) { onDown = fn }, off() {} }) } },
    events: { once() {}, on() {}, off() {} },
    emitStats() {},
    updateHealthBar() {},
    pickupBurst() {},
    spawnDrop(x, y, item) { this.drops.push({ x, y, item, visual: { scaleX: 1, scaleY: 1, setY() {}, setScale() {} }, glow: { setAlpha() {} }, sparkles: [] }) },
    destroyDrop() {},
    updateDrops() {
      const drop = this.drops[0]
      assert.ok(drop, 'original updateDrops must receive the selected drop, never null')
      this.playerState.weapon = drop.item.type
      this.playerState.weaponRarity = drop.item.rarity
      this.playerState.weaponDamage = drop.item.damage
      this.playerState.weaponAffixes = drop.item.affixes ?? []
      this.playerState.equippedWeapon = drop.item
      this.drops.splice(0, 1)
    },
    clearDrops() { this.drops = [] },
  }

  installPickupInteraction(scene)
  scene.updateDrops()
  assert.ok(onDown)
  assert.doesNotThrow(() => onDown())
  assert.equal(scene.drops.some((drop) => drop == null), false)
  assert.equal(scene.playerState.weapon, candidate.item.type)
})
