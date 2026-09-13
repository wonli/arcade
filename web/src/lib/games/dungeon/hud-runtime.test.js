import { describe, expect, it } from 'vitest'
import { dungeonHudModel, HUD_INSET } from './hud-runtime.js'

describe('dungeon HUD model', () => {
  it('anchors the HUD inside the 48px dungeon border', () => {
    const model = dungeonHudModel({
      stats: { hp: 84, maxHp: 100, kills: 3, healthPotions: 2, weapon: null },
      progress: { floor: 1, roomRole: 'combat' },
      labels: { hp: 'HP', weapon: 'WEAPON', details: 'STATS', none: 'None', emptyWeapon: 'No weapon', combat: 'Combat' },
    })

    expect(HUD_INSET).toBe(56)
    expect(model.bounds.left).toEqual({ x: 56, y: 56, width: 286, height: 72 })
    expect(model.bounds.right).toEqual({ x: 618, y: 56, width: 286, height: 72 })
  })

  it('formats live combat state for Phaser text objects', () => {
    const model = dungeonHudModel({
      stats: { hp: 84, maxHp: 100, kills: 3, healthPotions: 2, weapon: null },
      progress: { floor: 1, roomRole: 'combat' },
      labels: { weapon: 'WEAPON', details: 'STATS', none: 'None', emptyWeapon: 'No weapon', combat: 'Combat' },
    })

    expect(model.hpText).toBe('84/100')
    expect(model.hpRatio).toBe(0.84)
    expect(model.metaText).toBe('F1  ·  Combat  ·  ☠ 3')
    expect(model.potionText).toBe('2')
    expect(model.weaponTitle).toBe('None')
    expect(model.weaponDetail).toBe('No weapon')
  })
})
