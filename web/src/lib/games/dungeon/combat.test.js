import test from 'node:test'
import assert from 'node:assert/strict'
import { nearestTarget, rollDamage, rollDrop, applyPickup } from './combat.js'

test('nearestTarget ignores dead enemies and picks the closest living target', () => {
  const player = { x: 0, y: 0 }
  const enemies = [
    { id: 'dead', x: 1, y: 0, hp: 0 },
    { id: 'far', x: 9, y: 0, hp: 20 },
    { id: 'near', x: 3, y: 4, hp: 20 },
  ]
  assert.equal(nearestTarget(player, enemies)?.id, 'near')
})

test('rollDamage uses crit multiplier deterministically', () => {
  assert.deepEqual(rollDamage({ damage: 12, critChance: 0.2, critMultiplier: 2 }, () => 0.1), { damage: 24, critical: true })
  assert.deepEqual(rollDamage({ damage: 12, critChance: 0.2, critMultiplier: 2 }, () => 0.9), { damage: 12, critical: false })
})

test('rollDrop creates equipment, healing, or nothing from one roll', () => {
  assert.deepEqual(rollDrop(7, () => 0.02), {
    type: 'weapon.rust_sword',
    rarity: 'uncommon',
    damage: 3,
  })
  assert.deepEqual(rollDrop(7, () => 0.22), {
    type: 'consumable.health_potion',
    rarity: 'common',
    heal: 28,
  })
  assert.equal(rollDrop(7, () => 0.9), null)
})

test('picking up a weapon immediately increases damage', () => {
  const player = { damage: 10, weapon: null }
  const next = applyPickup(player, { type: 'weapon.rust_sword', rarity: 'uncommon', damage: 3 })
  assert.equal(next.damage, 13)
  assert.equal(next.weapon, 'weapon.rust_sword')
})

test('picking up a health potion heals without exceeding max hp', () => {
  assert.equal(applyPickup({ hp: 40, maxHp: 100 }, { type: 'consumable.health_potion', heal: 28 }).hp, 68)
  assert.equal(applyPickup({ hp: 90, maxHp: 100 }, { type: 'consumable.health_potion', heal: 28 }).hp, 100)
})
