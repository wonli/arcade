import test from 'node:test'
import assert from 'node:assert/strict'

import {
  applyEquipmentState,
  clearModifierLayer,
  currentEffects,
  currentWeapon,
  setModifierLayer,
} from './player-loadout.js'

test('canonical equipment weapon is the only weapon source', () => {
  const canonical = { type: 'weapon.canonical', archetype: 'staff', rarity: 'rare', damage: 11, affixes: [] }
  const legacy = { type: 'weapon.legacy', archetype: 'sword', rarity: 'common', damage: 1, affixes: [] }

  assert.equal(currentWeapon({ equipment: { weapon: canonical }, equippedWeapon: legacy, weapon: legacy.type }), canonical)
  assert.equal(currentWeapon({ equippedWeapon: legacy, weapon: legacy.type }), null)
})

test('equipment replacement preserves non-equipment modifier layers', () => {
  const current = {
    hp: 80,
    modifiers: {
      passive: { skillRadius: 0.1 },
      temporary: { attackSpeed: 0.15 },
      equipment: { lifeSteal: 0.05 },
    },
  }
  const weapon = { type: 'weapon.tempest', archetype: 'bow', rarity: 'rare', damage: 9, affixes: [] }
  const next = applyEquipmentState(current, weapon, { attackSpeed: 0.2, lifeSteal: 0.08 })

  assert.equal(next.equipment.weapon.type, 'weapon.tempest')
  assert.equal(next.modifiers.passive.skillRadius, 0.1)
  assert.equal(next.modifiers.temporary.attackSpeed, 0.15)
  assert.equal(next.modifiers.equipment.attackSpeed, 0.2)
  assert.equal(currentEffects(next).attackSpeed, 0.35)
  assert.equal(currentEffects(next).skillRadius, 0.1)
  assert.equal(currentEffects(next).lifeSteal, 0.08)
})

test('modifier layer updates keep only canonical modifier state', () => {
  const state = setModifierLayer({}, 'temporary', { attackSpeed: 0.2, skillHaste: 0.1 })
  const withPassive = setModifierLayer(state, 'passive', { skillRadius: 0.25 })

  assert.equal('effects' in withPassive, false)
  assert.equal(currentEffects(withPassive).attackSpeed, 0.2)
  assert.equal(currentEffects(withPassive).skillHaste, 0.1)
  assert.equal(currentEffects(withPassive).skillRadius, 0.25)

  const cleared = clearModifierLayer(withPassive, 'temporary')
  assert.equal('effects' in cleared, false)
  assert.equal(currentEffects(cleared).attackSpeed, undefined)
  assert.equal(currentEffects(cleared).skillHaste, undefined)
  assert.equal(currentEffects(cleared).skillRadius, 0.25)
})

test('equipment application emits no legacy mirrors', () => {
  const weapon = {
    type: 'weapon.arcane_spire', archetype: 'staff', rarity: 'epic', damage: 13,
    affixes: [{ id: 'skill_haste', tier: 2, value: 0.2 }],
  }
  const next = applyEquipmentState({}, weapon, { skillHaste: 0.2 })

  assert.deepEqual(next.equipment.weapon, weapon)
  assert.deepEqual(next.modifiers.equipment, { skillHaste: 0.2 })
  for (const key of ['equippedWeapon', 'weapon', 'weaponRarity', 'weaponDamage', 'weaponAffixes', 'effects']) {
    assert.equal(key in next, false, `${key} mirror should not exist`)
  }
})

test('legacy effects are not treated as modifier source', () => {
  assert.deepEqual(currentEffects({ effects: { attackSpeed: 0.9 } }), {})
})
