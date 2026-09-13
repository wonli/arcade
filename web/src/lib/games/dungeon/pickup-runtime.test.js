import test from 'node:test'
import assert from 'node:assert/strict'
import { installPickupInteraction, prepareDropItem, resolveDropPosition, weaponDamageForFloor } from './pickup-runtime.js'

const sequence = (values) => { let i = 0; return () => values[i++ % values.length] }

test('weapon damage grows with floor while floor one can still jackpot', () => {
  const low = weaponDamageForFloor('rare', 1, sequence([0.5, 0.9, 0.5]))
  const deep = weaponDamageForFloor('rare', 20, sequence([0.5, 0.9, 0.5]))
  const jackpot = weaponDamageForFloor('rare', 1, sequence([0.9, 0.01, 0.99]))
  assert.ok(deep > low + 30)
  assert.ok(jackpot >= low * 1.5)
})

test('opened chest can turn its weapon reward into a potion', () => {
  const scene = { floor: 8, __dungeonSpatial: { getChests: () => [{ x: 100, y: 100, opened: true }] } }
  const item = { type: 'weapon.dungeon_blade', rarity: 'rare', damage: 8, affixes: [] }
  assert.deepEqual(prepareDropItem(scene, 110, 110, item, sequence([0.05])), { type: 'consumable.health_potion', rarity: 'common', heal: 28 })
})

test('weapon rewards are floor-scaled even outside chests', () => {
  const scene = { floor: 18, __dungeonSpatial: { getChests: () => [] } }
  const item = { type: 'weapon.dungeon_blade', rarity: 'uncommon', damage: 5, affixes: [] }
  const next = prepareDropItem(scene, 0, 0, item, sequence([0.5, 0.9, 0.5]))
  assert.ok(next.damage > 30)
})

test('drops are moved off blocked terrain to a reachable nearby point', () => {
  const geometry = {
    width: 240,
    height: 180,
    bounds: { x: 0, y: 0, width: 240, height: 180 },
    solids: [{ x: 92, y: 62, width: 56, height: 56, kind: 'prop' }],
    water: [],
    bridges: [],
  }
  const scene = {
    playerState: { x: 48, y: 90 },
    __dungeonSpatial: { getGeometry: () => geometry },
  }
  const safe = resolveDropPosition(scene, 120, 90)
  assert.notDeepEqual(safe, { x: 120, y: 90 })
  assert.ok(safe.x < 92 || safe.x > 148 || safe.y < 62 || safe.y > 118)
  assert.ok(Math.hypot(safe.x - 120, safe.y - 90) <= 80)
})

test('equipping with E leaves the previous weapon on the ground', () => {
  let onDown = null
  const oldWeapon = { type: 'weapon.dungeon_blade', rarity: 'rare', damage: 22, affixes: [{ id: 'power', tier: 1, value: 0.1 }] }
  const candidate = { type: 'weapon.dungeon_blade', rarity: 'epic', damage: 40, affixes: [] }
  const scene = {
    floor: 6,
    playerState: { x: 0, y: 0, weapon: oldWeapon.type, weaponRarity: oldWeapon.rarity, weaponDamage: oldWeapon.damage, weaponAffixes: oldWeapon.affixes, equippedWeapon: oldWeapon },
    drops: [],
    time: { now: 0 },
    input: { keyboard: { addKey: () => ({ on(_event, fn) { onDown = fn }, off() {} }) } },
    events: { once() {} },
    emitStats() {},
    spawnDrop(x, y, item) { this.drops.push({ x, y, item, visual: { scaleX: 1, scaleY: 1, setY() {}, setScale() {} }, glow: { setAlpha() {} } }) },
    updateDrops() {
      const drop = this.drops[0]
      if (!drop) return
      this.playerState.weapon = drop.item.type
      this.playerState.weaponRarity = drop.item.rarity
      this.playerState.weaponDamage = drop.item.damage
      this.playerState.weaponAffixes = drop.item.affixes ?? []
      this.playerState.equippedWeapon = drop.item
      this.drops.splice(0, 1)
    },
    clearDrops() { this.drops = [] },
  }
  installPickupInteraction(scene, { random: sequence([0.5, 0.9, 0.5]) })
  scene.spawnDrop(0, 0, candidate)
  scene.updateDrops()
  onDown()
  assert.equal(scene.playerState.weaponRarity, 'epic')
  assert.equal(scene.drops.length, 1)
  assert.equal(scene.drops[0].item.rarity, 'rare')
  assert.equal(scene.drops[0].item.damage, 22)
})
