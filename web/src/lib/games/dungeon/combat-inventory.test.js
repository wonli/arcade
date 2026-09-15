import test from 'node:test'
import assert from 'node:assert/strict'

import { applyPickup } from './combat.js'

test('health potion pickup stores inventory instead of healing immediately', () => {
  const state = { hp: 40, maxHp: 100, healthPotions: 2 }
  const next = applyPickup(state, { type: 'consumable.health_potion', rarity: 'common', heal: 28 })

  assert.equal(next.hp, 40)
  assert.equal(next.maxHp, 100)
  assert.equal(next.healthPotions, 3)
})
