import test from 'node:test'
import assert from 'node:assert/strict'

import {
  AFFIXES,
  affixSlots,
  rollAffixes,
  deriveEquipment,
  affixSummary,
  specializeWeaponAffixes,
} from './affixes.js'
import { currentEffects, currentWeapon } from './player-loadout.js'

const sequence = (values) => {
  let index = 0
  return () => values[index++ % values.length]
}

test('affix catalog contains the approved affixes including ranged build specializations', () => {
  assert.equal(Object.keys(AFFIXES).length, 20)
  for (const id of [
    'power', 'attack_speed', 'critical', 'movement_speed', 'vitality', 'life_steal',
    'piercing', 'chain', 'corpse_burst', 'critical_heal', 'hurt_haste', 'low_health_damage', 'skill_radius', 'skill_haste',
    'whirlwind', 'volley', 'arcane_nova', 'thunder', 'executioner', 'berserker',
  ]) assert.ok(AFFIXES[id], `missing ${id}`)
  assert.equal(AFFIXES.volley.rollable, false)
  assert.equal(AFFIXES.arcane_nova.rollable, false)
})

test('rarity maps to fixed affix slot counts', () => {
  assert.equal(affixSlots('common'), 0)
  assert.equal(affixSlots('uncommon'), 1)
  assert.equal(affixSlots('rare'), 2)
  assert.equal(affixSlots('epic'), 3)
})

test('build affixes are gated before floor three and forced boss rolls contain exactly one build identity', () => {
  const floorTwo = rollAffixes(2, 'epic', sequence([0.99, 0.91, 0.83, 0.74, 0.61, 0.52, 0.43]))
  assert.equal(floorTwo.length, 3)
  assert.equal(floorTwo.some((affix) => AFFIXES[affix.id].category === 'build'), false)

  const boss = rollAffixes(5, 'epic', sequence([0.1, 0.9, 0.4, 0.8, 0.3, 0.7]), { forceBuild: true })
  assert.equal(boss.length, 3)
  assert.equal(boss.filter((affix) => AFFIXES[affix.id].category === 'build').length, 1)
  assert.equal(new Set(boss.map((affix) => affix.id)).size, boss.length)
  assert.equal(boss.some((affix) => affix.id === 'volley' || affix.id === 'arcane_nova'), false)
})

test('higher floor rolls use stronger affix tiers', () => {
  const low = rollAffixes(1, 'uncommon', () => 0)
  const high = rollAffixes(5, 'uncommon', () => 0)
  assert.equal(low[0].tier, 1)
  assert.equal(high[0].tier, 3)
  assert.ok(high[0].value >= low[0].value)
})

test('weapon build slot specializes by archetype without changing its rolled power', () => {
  const whirlwind = { id: 'whirlwind', tier: 2, value: 0.26 }
  const bow = specializeWeaponAffixes({ type: 'weapon.tempest_bow', archetype: 'bow', affixes: [whirlwind] })
  const staff = specializeWeaponAffixes({ type: 'weapon.arcane_spire', archetype: 'staff', affixes: [whirlwind] })
  const sword = specializeWeaponAffixes({ type: 'weapon.iron_fang', archetype: 'sword', affixes: [whirlwind] })

  assert.deepEqual(bow.affixes[0], { id: 'volley', tier: 2, value: 0.26 })
  assert.deepEqual(staff.affixes[0], { id: 'arcane_nova', tier: 2, value: 0.26 })
  assert.deepEqual(sword.affixes[0], whirlwind)
})

test('deriving old ranged equipment specializes canonical affixes and modifiers', () => {
  const base = { damage: 10, critChance: 0.18, speed: 190, maxHp: 100 }
  const bow = deriveEquipment(base, {
    type: 'weapon.tempest_bow', archetype: 'bow', rarity: 'epic', damage: 9,
    affixes: [{ id: 'whirlwind', tier: 2, value: 0.26 }],
  }, { hp: 100, maxHp: 100 })
  const staff = deriveEquipment(base, {
    type: 'weapon.arcane_spire', archetype: 'staff', rarity: 'epic', damage: 9,
    affixes: [{ id: 'whirlwind', tier: 2, value: 0.26 }],
  }, { hp: 100, maxHp: 100 })

  assert.equal(currentEffects(bow).whirlwind, 0)
  assert.equal(currentEffects(bow).volley, 0.26)
  assert.equal(currentWeapon(bow).affixes[0].id, 'volley')
  assert.equal(currentEffects(staff).whirlwind, 0)
  assert.equal(currentEffects(staff).arcaneNova, 0.26)
  assert.equal(currentWeapon(staff).affixes[0].id, 'arcane_nova')
})

test('deriving equipment rebuilds stats instead of accumulating old weapon bonuses', () => {
  const base = { damage: 10, critChance: 0.18, speed: 190, maxHp: 100 }
  const strong = deriveEquipment(base, {
    type: 'weapon.dungeon_blade', rarity: 'rare', damage: 12,
    affixes: [{ id: 'power', tier: 1, value: 0.2 }, { id: 'critical', tier: 1, value: 0.05 }],
  }, { hp: 60 })
  const weak = deriveEquipment(base, {
    type: 'weapon.dungeon_blade', rarity: 'uncommon', damage: 4,
    affixes: [{ id: 'movement_speed', tier: 1, value: 0.08 }],
  }, strong)

  assert.ok(strong.damage > weak.damage)
  assert.equal(weak.damage, 14)
  assert.equal(weak.critChance, 0.18)
  assert.ok(weak.speed > base.speed)
})

test('vitality increases max hp and grants the newly gained max hp on equip', () => {
  const base = { damage: 10, critChance: 0.18, speed: 190, maxHp: 100 }
  const result = deriveEquipment(base, {
    type: 'weapon.dungeon_blade', rarity: 'uncommon', damage: 2,
    affixes: [{ id: 'vitality', tier: 1, value: 20 }],
  }, { hp: 55, maxHp: 100 })
  assert.equal(result.maxHp, 120)
  assert.equal(result.hp, 75)
})

test('derived modifiers expose normalized combat hooks and summary is compact', () => {
  const base = { damage: 10, critChance: 0.18, speed: 190, maxHp: 100 }
  const item = {
    type: 'weapon.dungeon_blade', rarity: 'epic', damage: 9,
    affixes: [
      { id: 'life_steal', tier: 2, value: 0.08 },
      { id: 'skill_haste', tier: 2, value: 0.16 },
      { id: 'thunder', tier: 2, value: 0.45 },
    ],
  }
  const result = deriveEquipment(base, item, { hp: 100, maxHp: 100 })
  const effects = currentEffects(result)
  assert.equal(effects.lifeSteal, 0.08)
  assert.equal(effects.skillHaste, 0.16)
  assert.equal(effects.thunder, 0.45)
  assert.equal(affixSummary(item).length, 3)
})

test('equipping a weapon preserves passive and temporary modifier layers', () => {
  const base = { damage: 10, critChance: 0.18, speed: 190, maxHp: 100 }
  const current = {
    hp: 80,
    maxHp: 100,
    modifiers: {
      passive: { skillRadius: 0.1 },
      temporary: { attackSpeed: 0.15 },
      equipment: { lifeSteal: 0.03 },
    },
  }
  const result = deriveEquipment(base, {
    type: 'weapon.dungeon_blade', archetype: 'sword', rarity: 'rare', damage: 7,
    affixes: [
      { id: 'attack_speed', tier: 1, value: 0.12 },
      { id: 'life_steal', tier: 1, value: 0.05 },
    ],
  }, current)
  const effects = currentEffects(result)

  assert.equal(result.equipment.weapon.type, 'weapon.dungeon_blade')
  assert.equal(result.modifiers.passive.skillRadius, 0.1)
  assert.equal(result.modifiers.temporary.attackSpeed, 0.15)
  assert.equal(result.modifiers.equipment.attackSpeed, 0.12)
  assert.equal(effects.attackSpeed, 0.27)
  assert.equal(effects.skillRadius, 0.1)
  assert.equal(effects.lifeSteal, 0.05)
})
