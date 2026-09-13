import test from 'node:test'
import assert from 'node:assert/strict'
import { setWeaponVisualSelected, weaponVisualProfile } from './weapon-visual-runtime.js'

test('named weapon visual uses dedicated 16x16 art instead of procedural fallback', () => {
  const item = { type: 'weapon.grave_cleaver', archetype: 'axe', rarity: 'rare' }
  const profile = weaponVisualProfile(item)
  assert.equal(profile.namedArt, true)
  assert.equal(profile.procedural, false)
  assert.match(profile.path, /Weapons%20Asset%2016x16\/034\.png$|Weapons Asset 16x16\/034\.png$/)
  assert.equal(profile.textureKey, 'dungeon-named-weapon-034-base')
  assert.ok(profile.scale > 2)
})

test('selected state swaps a named ground weapon to its selected texture', () => {
  const item = { type: 'weapon.iron_fang', archetype: 'dagger', rarity: 'common' }
  const visual = { textureKey: null, setTexture(key) { this.textureKey = key } }
  const scene = { textures: { exists: () => true } }
  assert.equal(setWeaponVisualSelected(scene, visual, item, true), true)
  assert.equal(visual.textureKey, 'dungeon-named-weapon-017-selected')
  assert.equal(setWeaponVisualSelected(scene, visual, item, false), true)
  assert.equal(visual.textureKey, 'dungeon-named-weapon-017-base')
})
