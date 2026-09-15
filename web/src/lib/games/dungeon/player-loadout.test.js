import test from 'node:test'
import assert from 'node:assert/strict'

import {
  applyEquipmentState,
  clearModifierLayer,
  currentEffects,
  currentWeapon,
  setModifierLayer,
} from './player-loadout.js'

test('canonical equipment weapon wins over compatibility mirrors', () => {
  const canonical = { type: 'weapon.canonical', archetype: 'staff', rarity: 'rare', damage: 11, affixes: [] }
  const legacy = { type: 'weapon.legacy', archetype: 'sword', rarity: 'common', damage: 1, affixes: [] }
  const state = { equipment: { weapon: canonical }, equippedWeapon: legacy, weapon: legacy.type }

  assert.equal(currentWeapon(state), canonical)
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

test('modifier layer updates keep the legacy effects mirror synchronized', () => {
  const state = setModifierLayer({ effects: {} }, 'temporary', { attackSpeed: 0.2, skillHaste: 0.1 })
  const withPassive = setModifierLayer(state, 'passive', { skillRadius: 0.25 })

  assert.equal(withPassive.effects.attackSpeed, 0.2)
  assert.equal(withPassive.effects.skillHaste, 0.1)
  assert.equal(withPassive.effects.skillRadius, 0.25)
  assert.deepEqual(withPassive.effects, currentEffects(withPassive))

  const cleared = clearModifierLayer(withPassive, 'temporary')
  assert.equal(cleared.effects.attackSpeed, undefined)
  assert.equal(cleared.effects.skillHaste, undefined)
  assert.equal(cleared.effects.skillRadius, 0.25)
  assert.deepEqual(cleared.effects, currentEffects(cleared))
})

test('compatibility mirrors are derived from canonical equipment state', () => {
  const weapon = {
    type: 'weapon.arcane_spire', archetype: 'staff', rarity: 'epic', damage: 13,
    affixes: [{ id: 'skill_haste', tier: 2, value: 0.2 }],
  }
  const next = applyEquipmentState({}, weapon, { skillHaste: 0.2 })

  assert.equal(next.equippedWeapon.type, next.equipment.weapon.type)
  assert.equal(next.weapon, next.equipment.weapon.type)
  assert.equal(next.weaponRarity, next.equipment.weapon.rarity)
  assert.equal(next.weaponDamage, next.equipment.weapon.damage)
  assert.deepEqual(next.weaponAffixes, next.equipment.weapon.affixes)
  assert.deepEqual(next.effects, currentEffects(next))
})
