import test from 'node:test'
import assert from 'node:assert/strict'
import { installDungeonWeaponCatalog, weaponizeDrop } from './weapon-catalog-runtime.js'

const sequence = (values) => { let index = 0; return () => values[index++ % values.length] }

test('generic dungeon weapon becomes a named weapon while preserving quality and stats', () => {
  const item = weaponizeDrop({ type: 'weapon.dungeon_blade', rarity: 'epic', damage: 18, affixes: [] }, 1, () => 0)
  assert.equal(item.type, 'weapon.iron_fang')
  assert.equal(item.name, 'Iron Fang')
  assert.equal(item.rarity, 'epic')
  assert.equal(item.damage, 18)
})

test('generic bow and staff stay ranged when materialized on floor one', () => {
  const bow = weaponizeDrop({ type: 'weapon.dungeon_blade', archetype: 'bow', rarity: 'rare', damage: 12, affixes: [] }, 1, () => 0.5)
  const staff = weaponizeDrop({ type: 'weapon.dungeon_blade', archetype: 'staff', rarity: 'rare', damage: 12, affixes: [] }, 1, sequence([0.5, 0.2]))
  assert.equal(bow.archetype, 'bow')
  assert.equal(bow.type, 'weapon.tempest_bow')
  assert.equal(staff.archetype, 'staff')
  assert.equal(staff.type, 'weapon.arcane_spire')
})

test('generic staff signatures use deterministic 40/30/30 boundaries', () => {
  const makeStaff = (signatureRoll) => weaponizeDrop(
    { type: 'weapon.dungeon_blade', archetype: 'staff', rarity: 'rare', damage: 12, affixes: [] },
    1,
    sequence([0.5, signatureRoll]),
  )
  assert.equal(makeStaff(0).signature, 'arcane_burst')
  assert.equal(makeStaff(0.399999).signature, 'arcane_burst')
  assert.equal(makeStaff(0.40).signature, 'storm_palm')
  assert.equal(makeStaff(0.699999).signature, 'storm_palm')
  assert.equal(makeStaff(0.70).signature, 'frost_blizzard')
  assert.equal(makeStaff(0.999999).signature, 'frost_blizzard')
})

test('ranged catalog drops specialize whirlwind into their own group skill', () => {
  const rolled = { id: 'whirlwind', tier: 2, value: 0.26 }
  const staff = weaponizeDrop({ type: 'weapon.dungeon_blade', rarity: 'epic', damage: 18, affixes: [rolled] }, 5, () => 0.84)
  const bow = weaponizeDrop({ type: 'weapon.dungeon_blade', rarity: 'epic', damage: 18, affixes: [rolled] }, 5, () => 0.95)

  assert.equal(staff.archetype, 'staff')
  assert.equal(staff.affixes[0].id, 'arcane_nova')
  assert.equal(bow.archetype, 'bow')
  assert.equal(bow.affixes[0].id, 'volley')
})

test('known catalog weapons are stable when dropped again', () => {
  const original = { id: 'storm_lance', name: 'Storm Lance', type: 'weapon.storm_lance', archetype: 'spear', vfxTheme: 'storm', rarity: 'rare', damage: 20, affixes: [] }
  assert.deepEqual(weaponizeDrop(original, 8, () => 0.9), original)
})

test('known ranged weapons also normalize legacy whirlwind affixes', () => {
  const bow = weaponizeDrop({ id: 'tempest_bow', name: 'Tempest Bow', type: 'weapon.tempest_bow', archetype: 'bow', vfxTheme: 'storm', rarity: 'epic', damage: 20, affixes: [{ id: 'whirlwind', tier: 2, value: 0.2 }] }, 8, () => 0.9)
  assert.equal(bow.affixes[0].id, 'volley')
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
