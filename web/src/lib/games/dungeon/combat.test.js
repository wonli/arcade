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

test('rollDrop can create a semantic sword upgrade', () => {
  assert.deepEqual(rollDrop(7, () => 0.02), {
    type: 'weapon.rust_sword',
    rarity: 'uncommon',
    damage: 3,
  })
  assert.equal(rollDrop(7, () => 0.9), null)
})

test('picking up a weapon immediately increases damage', () => {
  const player = { damage: 10, weapon: null }
  const next = applyPickup(player, { type: 'weapon.rust_sword', rarity: 'uncommon', damage: 3 })
  assert.equal(next.damage, 13)
  assert.equal(next.weapon, 'weapon.rust_sword')
})
