import test from 'node:test'
import assert from 'node:assert/strict'
import { weaponArchetype, weaponProfile } from './weapon-profile.js'

test('weapons without an explicit archetype fall back to sword', () => {
  assert.equal(weaponArchetype({ type: 'weapon.dungeon_blade' }), 'sword')
  assert.equal(weaponArchetype(null), 'sword')
})

test('canonical equipment weapon drives player weapon profile', () => {
  const state = {
    equipment: { weapon: { type: 'weapon.arcane_spire', archetype: 'staff' } },
  }
  assert.equal(weaponArchetype(state), 'staff')
  assert.equal(weaponProfile(state).attackMode, 'ranged')
})

test('all weapon identities resolve to an explicit combat archetype', () => {
  for (const archetype of ['dagger', 'sword', 'katana', 'greatsword', 'spear', 'axe', 'bow', 'staff']) {
    assert.equal(weaponProfile({ archetype }).archetype, archetype)
  }
})

test('profiles encode materially different combat roles', () => {
  const dagger = weaponProfile({ archetype: 'dagger' })
  const sword = weaponProfile({ archetype: 'sword' })
  const greatsword = weaponProfile({ archetype: 'greatsword' })
  const spear = weaponProfile({ archetype: 'spear' })
  const axe = weaponProfile({ archetype: 'axe' })
  const bow = weaponProfile({ archetype: 'bow' })
  const staff = weaponProfile({ archetype: 'staff' })
  assert.ok(dagger.intervalMultiplier < sword.intervalMultiplier)
  assert.ok(greatsword.damageMultiplier > sword.damageMultiplier)
  assert.ok(spear.range > greatsword.range)
  assert.ok(axe.knockbackMultiplier > greatsword.knockbackMultiplier)
  assert.ok(bow.range > spear.range)
  assert.equal(bow.attackMode, 'ranged')
  assert.equal(staff.attackMode, 'ranged')
})
