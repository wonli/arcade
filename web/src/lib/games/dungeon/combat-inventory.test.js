import test from 'node:test'
import assert from 'node:assert/strict'

import { applyPickup } from './combat.js'

test('health potion pickup heals a damaged player to full without storing it', () => {
  const state = { hp: 40, maxHp: 100, healthPotions: 2 }
  const next = applyPickup(state, { type: 'consumable.health_potion', rarity: 'common', heal: 28 })

  assert.equal(next.hp, 100)
  assert.equal(next.maxHp, 100)
  assert.equal(next.healthPotions, 2)
})

test('health potion pickup stores inventory when health is already full', () => {
  const state = { hp: 100, maxHp: 100, healthPotions: 2 }
  const next = applyPickup(state, { type: 'consumable.health_potion', rarity: 'common', heal: 28 })

  assert.equal(next.hp, 100)
  assert.equal(next.maxHp, 100)
  assert.equal(next.healthPotions, 3)
})
