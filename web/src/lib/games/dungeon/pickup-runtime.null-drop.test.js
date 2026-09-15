import { attachLegacyTestPlayer } from './test/player-fixture.js'
import test from 'node:test'
import assert from 'node:assert/strict'
import { installPickupInteraction } from './pickup-runtime.js'

test('equipping never replaces the selected drop with null', () => {
  let onDown = null
  let equippedCalls = 0
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
    playerState: { x: 0, y: 0, hp: 100, maxHp: 100, baseStats: { damage: 10, critChance: 0.18, speed: 190, maxHp: 100 }, equipment: { weapon: null } },
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
      if (!drop) return
      equippedCalls++
      assert.equal(drop, candidate, 'confirmed pickup must pass the selected drop to the original updater')
      this.localPlayer.state.equipment = { weapon: drop.item }
      this.drops.splice(0, 1)
    },
    clearDrops() { this.drops = [] },
  }

  installPickupInteraction(attachLegacyTestPlayer(scene))
  scene.updateDrops()
  assert.ok(onDown)
  assert.equal(equippedCalls, 0, 'confirmable weapons must not auto-equip during ordinary drop updates')
  assert.doesNotThrow(() => onDown())
  assert.equal(equippedCalls, 1)
  assert.equal(scene.drops.some((drop) => drop == null), false)
  assert.equal(scene.localPlayer.state.equipment.weapon.type, candidate.item.type)
})
