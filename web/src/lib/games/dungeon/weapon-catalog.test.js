import test from 'node:test'
import assert from 'node:assert/strict'
import { WEAPON_CATALOG, availableWeapons, materializeWeapon, rollWeaponDefinition, weaponDefinition } from './weapon-catalog.js'

test('catalog contains twelve stable weapon identities independent from rarity', () => {
  assert.equal(WEAPON_CATALOG.length, 12)
  assert.equal(new Set(WEAPON_CATALOG.map((weapon) => weapon.id)).size, 12)
  assert.equal(weaponDefinition('weapon.tempest_bow')?.archetype, 'bow')
  assert.equal(weaponDefinition('starfall_spear')?.vfxTheme, 'arcane')
  assert.equal('rarity' in WEAPON_CATALOG[0], false)
})

test('deeper floors expand the weapon identity pool', () => {
  assert.equal(availableWeapons(1).length, 3)
  assert.ok(availableWeapons(6).length > availableWeapons(3).length)
  assert.equal(rollWeaponDefinition(1, () => 0.99).id, 'ash_saber')
})

test('materialization keeps rolled quality and stats while applying identity', () => {
  const item = materializeWeapon(weaponDefinition('storm_lance'), { rarity: 'epic', damage: 22, affixes: [{ id: 'power', value: 0.2 }] })
  assert.equal(item.type, 'weapon.storm_lance')
  assert.equal(item.archetype, 'spear')
  assert.equal(item.vfxTheme, 'storm')
  assert.equal(item.rarity, 'epic')
  assert.equal(item.damage, 22)
  assert.equal(item.affixes.length, 1)
})
