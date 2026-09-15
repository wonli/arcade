import test from 'node:test'
import assert from 'node:assert/strict'

import {
  AUTO_POTION_THRESHOLD,
  HEALTH_POTION_HEAL_RATIO,
  healthPotionPickupMode,
  pickupHealthPotion,
  shouldAutoUseHealthPotion,
  storeHealthPotion,
  useStoredHealthPotion,
} from './inventory.js'

test('damaged players consume ground potions while full-health players store them', () => {
  assert.equal(healthPotionPickupMode({ hp: 100, maxHp: 100, healthPotions: 0 }), 'store')
  assert.equal(healthPotionPickupMode({ hp: 72, maxHp: 100, healthPotions: 0 }), 'consume')
  assert.equal(healthPotionPickupMode({ hp: 20, maxHp: 100, healthPotions: 0 }), 'consume')
})

test('picking up a potion while damaged heals to full without changing inventory', () => {
  const result = pickupHealthPotion({ hp: 40, maxHp: 100, healthPotions: 2 })

  assert.equal(result.state.hp, 100)
  assert.equal(result.state.healthPotions, 2)
  assert.equal(result.healed, 60)
  assert.equal(result.stored, false)
})

test('picking up a potion at full health stores it without healing', () => {
  const result = pickupHealthPotion({ hp: 100, maxHp: 100, healthPotions: 2 })

  assert.equal(result.state.hp, 100)
  assert.equal(result.state.healthPotions, 3)
  assert.equal(result.healed, 0)
  assert.equal(result.stored, true)
})

test('storing a potion increments inventory without changing health', () => {
  assert.deepEqual(storeHealthPotion({ hp: 40, maxHp: 100, healthPotions: 2 }), {
    hp: 40,
    maxHp: 100,
    healthPotions: 3,
  })
})

test('auto potion triggers at thirty percent health when inventory is available', () => {
  assert.equal(AUTO_POTION_THRESHOLD, 0.30)
  assert.equal(shouldAutoUseHealthPotion({ hp: 30, maxHp: 100, healthPotions: 1 }), true)
  assert.equal(shouldAutoUseHealthPotion({ hp: 31, maxHp: 100, healthPotions: 1 }), false)
  assert.equal(shouldAutoUseHealthPotion({ hp: 20, maxHp: 100, healthPotions: 0 }), false)
})

test('stored potion heals thirty percent of max hp and decrements inventory', () => {
  assert.equal(HEALTH_POTION_HEAL_RATIO, 0.30)
  assert.deepEqual(useStoredHealthPotion({ hp: 60, maxHp: 200, healthPotions: 2 }), {
    hp: 120,
    maxHp: 200,
    healthPotions: 1,
    healed: 60,
    used: true,
  })
})

test('percentage healing clamps at max hp and never wastes a potion at full health', () => {
  assert.deepEqual(useStoredHealthPotion({ hp: 185, maxHp: 200, healthPotions: 2 }), {
    hp: 200,
    maxHp: 200,
    healthPotions: 1,
    healed: 15,
    used: true,
  })
  assert.deepEqual(useStoredHealthPotion({ hp: 200, maxHp: 200, healthPotions: 2 }), {
    hp: 200,
    maxHp: 200,
    healthPotions: 2,
    healed: 0,
    used: false,
  })
})

test('legacy fixed-heal callers still resolve to percentage healing', () => {
  assert.equal(useStoredHealthPotion({ hp: 20, maxHp: 200, healthPotions: 1 }, 28).healed, 60)
})
