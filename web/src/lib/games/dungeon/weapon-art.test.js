import test from 'node:test'
import assert from 'node:assert/strict'
import { namedWeaponArt, namedWeaponArtEntries } from './weapon-art.js'

const ids = [
  'weapon.iron_fang','weapon.warden_blade','weapon.ash_saber','weapon.grave_cleaver',
  'weapon.frostbite','weapon.storm_lance','weapon.ember_maul','weapon.void_edge',
  'weapon.blood_reaver','weapon.arcane_spire','weapon.tempest_bow','weapon.starfall_spear',
]

test('all twelve named weapons have stable base and selected art', () => {
  assert.equal(namedWeaponArtEntries().length, 12)
  for (const type of ids) {
    const art = namedWeaponArt(type)
    assert.ok(art, type)
    assert.match(art.base, /Weapons Asset 16x16\/\d{3}\.png$/)
    assert.match(art.selected, /Weapons Asset 16x16\/Selected Version\/\d{3}\.png$/)
    assert.equal(art.base.match(/(\d{3})\.png$/)[1], art.selected.match(/(\d{3})\.png$/)[1])
  }
})

test('corrected polearm greatsword and staff identities use intended sprite rows', () => {
  assert.equal(namedWeaponArt('weapon.storm_lance').number, '087')
  assert.equal(namedWeaponArt('weapon.starfall_spear').number, '090')
  assert.equal(namedWeaponArt('weapon.ember_maul').number, '094')
  assert.equal(namedWeaponArt('weapon.blood_reaver').number, '095')
  assert.equal(namedWeaponArt('weapon.arcane_spire').number, '060')
})

test('legacy and unknown weapon types do not claim named art', () => {
  assert.equal(namedWeaponArt('weapon.dungeon_blade'), null)
  assert.equal(namedWeaponArt('weapon.nope'), null)
})
