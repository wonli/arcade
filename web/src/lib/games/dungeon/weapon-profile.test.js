import test from 'node:test'
import assert from 'node:assert/strict'
import { weaponArchetype, weaponProfile } from './weapon-profile.js'

test('legacy weapons fall back to sword', () => {
  assert.equal(weaponArchetype({ type: 'weapon.dungeon_blade' }), 'sword')
  assert.equal(weaponArchetype({ weapon: 'weapon.rust_sword' }), 'sword')
})

test('dagger is fast and close while katana is slower and longer', () => {
  const dagger = weaponProfile({ archetype: 'dagger' })
  const sword = weaponProfile({ archetype: 'sword' })
  const katana = weaponProfile({ archetype: 'katana' })
  assert.ok(dagger.intervalMultiplier < sword.intervalMultiplier)
  assert.ok(dagger.range < sword.range)
  assert.ok(dagger.damageMultiplier < sword.damageMultiplier)
  assert.ok(katana.intervalMultiplier > sword.intervalMultiplier)
  assert.ok(katana.range > sword.range)
  assert.ok(katana.damageMultiplier > sword.damageMultiplier)
  assert.ok(dagger.swingMs < sword.swingMs)
  assert.ok(katana.swingMs > sword.swingMs)
})

test('player state resolves equipped weapon archetype', () => {
  assert.equal(weaponArchetype({ equippedWeapon: { archetype: 'katana' } }), 'katana')
  assert.equal(weaponProfile({ equippedWeapon: { archetype: 'dagger' } }).range, 132)
})
