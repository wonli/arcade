import test from 'node:test'
import assert from 'node:assert/strict'
import {
  LEGENDARY_WEAPON_CATALOG,
  WEAPON_CATALOG,
  availableWeapons,
  materializeWeapon,
  rollBossLegendary,
  rollWeaponDefinition,
  weaponDefinition,
} from './weapon-catalog.js'

test('catalog contains twelve standard and twelve boss-only legendary identities', () => {
  assert.equal(WEAPON_CATALOG.length, 24)
  assert.equal(new Set(WEAPON_CATALOG.map((weapon) => weapon.id)).size, 24)
  assert.equal(LEGENDARY_WEAPON_CATALOG.length, 12)
  assert.deepEqual(LEGENDARY_WEAPON_CATALOG.map((weapon) => weapon.swordNumber), [11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22])
  assert.ok(LEGENDARY_WEAPON_CATALOG.every((weapon) => weapon.bossOnly))
  assert.equal(weaponDefinition('weapon.tempest_bow')?.archetype, 'bow')
  assert.equal(weaponDefinition('crimson_verdict')?.vfxTheme, 'blood')

  const standard = WEAPON_CATALOG.filter((weapon) => !weapon.bossOnly)
  for (const theme of new Set(standard.map((weapon) => weapon.vfxTheme))) {
    const weapons = standard.filter((weapon) => weapon.vfxTheme === theme)
    assert.equal(new Set(weapons.map((weapon) => weapon.vfxVariant)).size, weapons.length)
  }
})

test('ordinary floor one pool includes real bow and staff identities without boss-only weapons', () => {
  const floorOne = availableWeapons(1)
  assert.ok(floorOne.some((weapon) => weapon.archetype === 'bow'))
  assert.ok(floorOne.some((weapon) => weapon.archetype === 'staff'))
  assert.equal(floorOne.some((weapon) => weapon.bossOnly), false)
  assert.equal(availableWeapons(99).some((weapon) => weapon.bossOnly), false)
  assert.ok(availableWeapons(6).length >= availableWeapons(3).length)
})

test('rollWeaponDefinition can respect a requested archetype from floor one', () => {
  assert.equal(rollWeaponDefinition(1, () => 0.4, 'bow')?.archetype, 'bow')
  assert.equal(rollWeaponDefinition(1, () => 0.4, 'staff')?.archetype, 'staff')
  assert.equal(rollWeaponDefinition(1, () => 0, 'dagger')?.id, 'iron_fang')
})

test('boss legendary roll always returns a legendary with exaggerated fixed affixes', () => {
  const first = rollBossLegendary(5, () => 0)
  const last = rollBossLegendary(8, () => 0.999999)
  assert.equal(first.type, 'weapon.kings_ruin')
  assert.equal(last.type, 'weapon.crimson_verdict')
  assert.equal(first.rarity, 'legendary')
  assert.equal(last.rarity, 'legendary')
  assert.equal(first.bossOnly, true)
  assert.equal(last.bossOnly, true)
  assert.equal(first.affixes.length, 4)
  assert.equal(last.affixes.length, 4)
  assert.ok(first.affixes.every((entry) => entry.tier === 4))
  assert.ok(last.damage > first.damage)
})

test('materialization keeps rolled quality and stats while applying identity', () => {
  const item = materializeWeapon(weaponDefinition('storm_lance'), { rarity: 'epic', damage: 22, affixes: [{ id: 'power', value: 0.2 }] })
  assert.equal(item.type, 'weapon.storm_lance')
  assert.equal(item.archetype, 'spear')
  assert.equal(item.vfxTheme, 'storm')
  assert.equal(item.vfxVariant, 0)
  assert.equal(item.rarity, 'epic')
  assert.equal(item.damage, 22)
  assert.equal(item.affixes.length, 1)
})
