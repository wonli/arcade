import test from 'node:test'
import assert from 'node:assert/strict'

import { applyRestChoice, consumeFortune, restChoices } from './rest.js'

test('rest offers recover temper and fortune', () => {
  assert.deepEqual(restChoices(), ['recover', 'temper', 'fortune'])
})

test('recover restores half max hp and clamps at max hp', () => {
  const player = { hp: 30, maxHp: 100, baseStats: { damage: 10, critChance: 0.18, speed: 190, maxHp: 100 } }
  assert.equal(applyRestChoice(player, 'recover').playerState.hp, 80)
  assert.equal(applyRestChoice({ ...player, hp: 80 }, 'recover').playerState.hp, 100)
})

test('temper strengthens one eligible basic affix and re-derives stats', () => {
  const player = {
    hp: 100, maxHp: 100, damage: 19, critChance: 0.18, speed: 190,
    baseStats: { damage: 10, critChance: 0.18, speed: 190, maxHp: 100 },
    equippedWeapon: { type: 'weapon.dungeon_blade', rarity: 'rare', damage: 5, affixes: [{ id: 'power', tier: 2, value: 0.2 }, { id: 'thunder', tier: 2, value: 0.3 }] },
  }
  const result = applyRestChoice(player, 'temper', () => 0)
  assert.ok(result.playerState.equippedWeapon.affixes[0].value > 0.2)
  assert.equal(result.playerState.equippedWeapon.affixes[1].value, 0.3)
  assert.ok(result.playerState.damage > 18)
})

test('temper falls back to base weapon damage when no basic affix exists', () => {
  const player = {
    hp: 100, maxHp: 100,
    baseStats: { damage: 10, critChance: 0.18, speed: 190, maxHp: 100 },
    equippedWeapon: { type: 'weapon.dungeon_blade', rarity: 'rare', damage: 5, affixes: [{ id: 'thunder', tier: 2, value: 0.3 }] },
  }
  const result = applyRestChoice(player, 'temper', () => 0)
  assert.equal(result.playerState.weaponDamage, 6)
})

test('temper still grants value before the first weapon is found', () => {
  const player = {
    hp: 100, maxHp: 100, damage: 10,
    baseStats: { damage: 10, critChance: 0.18, speed: 190, maxHp: 100 },
    equippedWeapon: null,
  }
  const result = applyRestChoice(player, 'temper', () => 0)
  assert.equal(result.playerState.baseStats.damage, 11)
  assert.equal(result.playerState.damage, 11)
})

test('fortune waits through non-combat rooms then consumes exactly once', () => {
  const activated = applyRestChoice({ hp: 100, maxHp: 100 }, 'fortune')
  assert.equal(activated.fortunePending, true)
  assert.deepEqual(consumeFortune(true, 'rest'), { active: false, remaining: true })
  assert.deepEqual(consumeFortune(true, 'combat'), { active: true, remaining: false })
  assert.deepEqual(consumeFortune(false, 'elite'), { active: false, remaining: false })
})
