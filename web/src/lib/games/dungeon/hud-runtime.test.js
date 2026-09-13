import { describe, expect, it } from 'vitest'
import {
  dungeonHudModel,
  HUD_INSET,
  HUD_WEAPON_ICON_URL,
} from './hud-runtime.js'

describe('dungeon HUD model', () => {
  it('keeps the compact HUD inside the playable area', () => {
    const model = dungeonHudModel({
      stats: {
        healthPotions: 2,
        weapon: { type: 'weapon.dungeon_blade' },
        weaponRarity: 'rare',
        weaponDamage: 18,
      },
      labels: {
        dungeonBlade: 'Dungeon Blade',
        baseDamage: 'DMG',
        'rarity:rare': 'Rare',
      },
    })

    expect(HUD_INSET).toBe(56)
    expect(model.bounds.weapon).toEqual({ x: 56, y: 56, width: 176, height: 48 })
    expect(model.bounds.potion).toEqual({ x: 240, y: 56, width: 58, height: 48 })
  })

  it('does not expose HP or room metadata in the compact HUD', () => {
    const model = dungeonHudModel({
      stats: {
        hp: 84,
        maxHp: 100,
        kills: 3,
        healthPotions: 2,
        weapon: { type: 'weapon.dungeon_blade' },
        weaponRarity: 'rare',
        weaponDamage: 18,
      },
      labels: {
        dungeonBlade: 'Dungeon Blade',
        baseDamage: 'DMG',
        'rarity:rare': 'Rare',
      },
    })

    expect(model).not.toHaveProperty('hpText')
    expect(model).not.toHaveProperty('hpRatio')
    expect(model).not.toHaveProperty('metaText')
    expect(model.weaponTitle).toBe('Rare Dungeon Blade')
    expect(model.weaponDetail).toBe('+18 DMG')
    expect(model.potionText).toBe('2')
  })

  it('keeps floor, chapter and boss status as a simple text readout', () => {
    const normal = dungeonHudModel({
      progress: { floor: 7, chapter: 2, roomRole: 'combat' },
      labels: { floor: 'Floor', chapter: 'Chapter', boss: 'Boss' },
    })
    const boss = dungeonHudModel({
      progress: { floor: 8, chapter: 2, roomRole: 'boss' },
      labels: { floor: 'Floor', chapter: 'Chapter', boss: 'Boss' },
    })

    expect(normal.progress).toEqual({
      floorLabel: 'Floor 7',
      chapterLabel: 'Chapter 2',
      boss: false,
      bossLabel: '',
    })
    expect(boss.progress).toEqual({
      floorLabel: 'Floor 8',
      chapterLabel: 'Chapter 2',
      boss: true,
      bossLabel: 'Boss',
    })
  })

  it('only bundles the weapon HUD art', () => {
    expect(HUD_WEAPON_ICON_URL).toContain('dagger_01.png')
  })
})
