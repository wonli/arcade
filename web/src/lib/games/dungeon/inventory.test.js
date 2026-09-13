import { describe, expect, it } from 'vitest'
import { healthPotionPickupMode, useStoredHealthPotion } from './inventory.js'

describe('dungeon health potion inventory', () => {
  it('stores a potion pickup at full health', () => {
    expect(healthPotionPickupMode({ hp: 100, maxHp: 100 })).toBe('store')
  })

  it('keeps auto-consume behavior while injured', () => {
    expect(healthPotionPickupMode({ hp: 72, maxHp: 100 })).toBe('consume')
  })

  it('uses a stored potion and decrements inventory', () => {
    expect(useStoredHealthPotion({ hp: 60, maxHp: 100, healthPotions: 2 }, 28)).toEqual({ hp: 88, maxHp: 100, healthPotions: 1, healed: 28, used: true })
  })

  it('does not waste a stored potion at full health', () => {
    expect(useStoredHealthPotion({ hp: 100, maxHp: 100, healthPotions: 2 }, 28)).toEqual({ hp: 100, maxHp: 100, healthPotions: 2, healed: 0, used: false })
  })
})
