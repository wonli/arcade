import test from 'node:test'
import assert from 'node:assert/strict'
import { installDungeonWeaponCatalog, weaponizeDrop } from './weapon-catalog-runtime.js'

test('generic dungeon weapon becomes a named weapon while preserving quality and stats', () => {
  const item = weaponizeDrop({ type: 'weapon.dungeon_blade', rarity: 'epic', damage: 18, affixes: [] }, 1, () => 0)
  assert.equal(item.type, 'weapon.iron_fang')
  assert.equal(item.name, 'Iron Fang')
  assert.equal(item.rarity, 'epic')
  assert.equal(item.damage, 18)
})

test('known catalog weapons are stable when dropped again', () => {
  const original = { id: 'storm_lance', name: 'Storm Lance', type: 'weapon.storm_lance', archetype: 'spear', vfxTheme: 'storm', rarity: 'rare', damage: 20, affixes: [] }
  assert.deepEqual(weaponizeDrop(original, 8, () => 0.9), original)
})

test('runtime wraps scene drops and restores original spawn function', () => {
  const dropped = []
  const scene = {
    floor: 3,
    spawnDrop(x, y, item) { dropped.push({ x, y, item }); return item },
    events: { once() {} },
  }
  const runtime = installDungeonWeaponCatalog(scene, { random: () => 0 })
  scene.spawnDrop(10, 20, { type: 'weapon.dungeon_blade', rarity: 'rare', damage: 12, affixes: [] })
  assert.equal(dropped[0].item.type, 'weapon.iron_fang')
  runtime.restore()
  scene.spawnDrop(1, 2, { type: 'weapon.dungeon_blade', rarity: 'common', damage: 2, affixes: [] })
  assert.equal(dropped[1].item.type, 'weapon.dungeon_blade')
})
