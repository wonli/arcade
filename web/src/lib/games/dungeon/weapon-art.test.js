import test from 'node:test'
import assert from 'node:assert/strict'
import { namedWeaponArt, namedWeaponArtEntries } from './weapon-art.js'

const standardIds = [
  'weapon.iron_fang','weapon.warden_blade','weapon.ash_saber','weapon.grave_cleaver',
  'weapon.frostbite','weapon.storm_lance','weapon.ember_maul','weapon.void_edge',
  'weapon.blood_reaver','weapon.arcane_spire','weapon.tempest_bow','weapon.starfall_spear',
]

const legendaryIds = [
  'weapon.kings_ruin','weapon.sunfall','weapon.white_silence','weapon.stormcrown',
  'weapon.void_testament','weapon.blood_oath','weapon.dawn_reaver','weapon.cinder_vow',
  'weapon.winters_end','weapon.thunderwake','weapon.starless_edge','weapon.crimson_verdict',
]

test('all standard and legendary named weapons have stable art', () => {
  assert.equal(namedWeaponArtEntries().length, 24)

  for (const type of standardIds) {
    const art = namedWeaponArt(type)
    assert.ok(art, type)
    assert.match(art.base, /Weapons%20Asset%2016x16\/\d{3}\.png$/)
    assert.match(art.selected, /Weapons%20Asset%2016x16\/Selected%20Version\/\d{3}\.png$/)
    assert.equal(art.base.match(/(\d{3})\.png$/)[1], art.selected.match(/(\d{3})\.png$/)[1])
    assert.match(art.base, /^file:/)
    assert.match(art.selected, /^file:/)
  }

  for (let index = 0; index < legendaryIds.length; index++) {
    const type = legendaryIds[index]
    const swordNumber = index + 11
    const art = namedWeaponArt(type)
    assert.ok(art, type)
    assert.equal(art.number, `sword-${swordNumber}`)
    assert.match(art.base, new RegExp(`/sword-7soul1_20201212/32x32/sword_${swordNumber}\\.png$`))
    assert.equal(art.selected, art.base)
    assert.equal(art.displayScale, 1)
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
