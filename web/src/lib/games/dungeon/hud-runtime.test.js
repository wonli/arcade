import test from 'node:test'
import assert from 'node:assert/strict'
import {
  dungeonHudModel,
  dungeonHudViewportMetrics,
  HUD_INSET,
  HUD_WEAPON_ICON_URL,
} from './hud-runtime.js'

test('mobile HUD metrics prefer the canvas screen size over Phaser logical size', () => {
  assert.deepEqual(dungeonHudViewportMetrics({
    canvas: { width: 336, height: 629 },
    viewport: { mode: 'cover', width: 960, height: 600, zoom: 1 },
    scale: { width: 960, height: 600 },
    mode: 'cover',
  }), {
    width: 336,
    height: 629,
    zoom: 629 / 600,
    mode: 'cover',
  })
})

test('dungeon HUD model keeps the compact HUD inside the playable area', () => {
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

  assert.equal(HUD_INSET, 56)
  assert.deepEqual(model.bounds.weapon, { x: 56, y: 56, width: 176, height: 48 })
  assert.deepEqual(model.bounds.potion, { x: 240, y: 56, width: 58, height: 48 })
})

test('dungeon HUD model does not expose HP or room metadata in the compact HUD', () => {
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

  assert.equal(Object.hasOwn(model, 'hpText'), false)
  assert.equal(Object.hasOwn(model, 'hpRatio'), false)
  assert.equal(Object.hasOwn(model, 'metaText'), false)
  assert.equal(model.weaponTitle, 'Rare Dungeon Blade')
  assert.equal(model.weaponDetail, '+18 DMG')
  assert.equal(model.potionText, '2')
})

test('dungeon HUD model keeps floor, chapter and boss status as a simple text readout', () => {
  const normal = dungeonHudModel({
    progress: { floor: 7, chapter: 2, roomRole: 'combat' },
    labels: { floor: 'Floor', chapter: 'Chapter', boss: 'Boss' },
  })
  const boss = dungeonHudModel({
    progress: { floor: 8, chapter: 2, roomRole: 'boss' },
    labels: { floor: 'Floor', chapter: 'Chapter', boss: 'Boss' },
  })

  assert.deepEqual(normal.progress, {
    floorLabel: 'Floor 7',
    chapterLabel: 'Chapter 2',
    boss: false,
    bossLabel: '',
  })
  assert.deepEqual(boss.progress, {
    floorLabel: 'Floor 8',
    chapterLabel: 'Chapter 2',
    boss: true,
    bossLabel: 'Boss',
  })
})

test('dungeon HUD only bundles the weapon HUD art', () => {
  assert.match(HUD_WEAPON_ICON_URL, /dagger_01\.png/)
})
