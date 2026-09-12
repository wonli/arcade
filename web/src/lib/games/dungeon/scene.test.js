import test from 'node:test'
import assert from 'node:assert/strict'

import { chooseDungeonAssets, directionFromInput, rarityPresentation, floorOutcome, roomLayoutForFloor } from './scene.js'
import { nearestConfirmableDrop, pickupIntent } from './pickup.js'

const manifest = {
  assets: [
    { path: '/assets/rpg-main-character/_down idle.png', width: 256, height: 128, frames: 4, frameWidth: 64, frameHeight: 64, source: 'rpg-main-character', action: 'idle', direction: 'down' },
    { path: '/assets/rpg-main-character/_down walk.png', width: 256, height: 128, frames: 4, frameWidth: 64, frameHeight: 64, source: 'rpg-main-character', action: 'walk', direction: 'down' },
    { path: '/assets/rpg-main-character/_down attack.png', width: 128, height: 128, frames: 2, frameWidth: 64, frameHeight: 64, source: 'rpg-main-character', action: 'attack', direction: 'down' },
    { path: '/assets/rpg-main-character/_side idle.png', width: 256, height: 128, frames: 4, frameWidth: 64, frameHeight: 64, source: 'rpg-main-character', action: 'idle', direction: 'side' },
    { path: '/assets/rpg-main-character/_side walk.png', width: 256, height: 128, frames: 4, frameWidth: 64, frameHeight: 64, source: 'rpg-main-character', action: 'walk', direction: 'side' },
    { path: '/assets/rpg-main-character/_side attack.png', width: 128, height: 128, frames: 2, frameWidth: 64, frameHeight: 64, source: 'rpg-main-character', action: 'attack', direction: 'side' },
    { path: '/assets/rpg-main-character/_up idle.png', width: 256, height: 128, frames: 4, frameWidth: 64, frameHeight: 64, source: 'rpg-main-character', action: 'idle', direction: 'up' },
    { path: '/assets/rpg-main-character/_up walk.png', width: 256, height: 128, frames: 4, frameWidth: 64, frameHeight: 64, source: 'rpg-main-character', action: 'walk', direction: 'up' },
    { path: '/assets/rpg-main-character/_up attack.png', width: 128, height: 128, frames: 2, frameWidth: 64, frameHeight: 64, source: 'rpg-main-character', action: 'attack', direction: 'up' },
    { path: '/assets/debts/Creatures/Skeleton.png', width: 64, height: 16, frames: 4, frameWidth: 16, frameHeight: 16, source: 'debts' },
    { path: '/assets/debts/Creatures/Bat.png', width: 64, height: 16, frames: 4, frameWidth: 16, frameHeight: 16, source: 'debts' },
    { path: '/assets/debts/Creatures/Dragon.png', width: 64, height: 16, frames: 4, frameWidth: 16, frameHeight: 16, source: 'debts' },
    { path: '/assets/debts/Characters/Wizard.png', width: 182, height: 18, frames: 4, frameWidth: 26, frameHeight: 18, source: 'debts' },
    { path: '/assets/debts/Creatures/Slime.png', width: 64, height: 16, frames: 4, frameWidth: 16, frameHeight: 16, source: 'debts' },
    { path: '/assets/debts/Tiles/BrickFloor.png', width: 16, height: 16, frames: 1, frameWidth: 16, frameHeight: 16, source: 'debts' },
    { path: '/assets/debts/Tiles/StoneWall.png', width: 16, height: 16, frames: 1, frameWidth: 16, frameHeight: 16, source: 'debts' },
    { path: '/assets/debts/Items/Sword.png', width: 16, height: 16, frames: 1, frameWidth: 16, frameHeight: 16, source: 'debts' },
    { path: '/assets/dungeon-tileset/Tiled_files/walls_floor.png', width: 272, height: 416, frames: 442, frameWidth: 16, frameHeight: 16, columns: 17, rows: 26, source: 'dungeon-tileset', kind: 'wall' },
  ],
}

test('prefers the RPG player and keeps enemies on Debts assets', () => {
  const assets = chooseDungeonAssets(manifest)
  assert.equal(assets.player.source, 'rpg-main-character')
  assert.equal(assets.player.down.walk.path, '/assets/rpg-main-character/_down walk.png')
  assert.equal(assets.enemies.skeleton.path, '/assets/debts/Creatures/Skeleton.png')
  assert.equal(assets.enemies.fast.path, '/assets/debts/Creatures/Bat.png')
  assert.equal(assets.enemies.brute.path, '/assets/debts/Creatures/Dragon.png')
  assert.equal(assets.enemies.ranged.path, '/assets/debts/Characters/Wizard.png')
  assert.notEqual(assets.enemies.skeleton.path, assets.enemies.fast.path)
  assert.notEqual(assets.enemies.ranged.path, assets.enemies.brute.path)
  assert.equal(assets.weapon.source, 'debts')
})

test('scene bootstrap keeps simple Debts surfaces while spatial runtime owns the authored tileset', () => {
  const assets = chooseDungeonAssets(manifest)
  assert.equal(assets.floor.source, 'debts')
  assert.equal(assets.wall.source, 'debts')
  assert.equal(assets.floor.path, '/assets/debts/Tiles/BrickFloor.png')
  assert.equal(assets.wall.path, '/assets/debts/Tiles/StoneWall.png')
})

test('resolves movement into four player directions', () => {
  assert.equal(directionFromInput(0, -1, 'down'), 'up')
  assert.equal(directionFromInput(0, 1, 'up'), 'down')
  assert.equal(directionFromInput(-1, 0, 'down'), 'left')
  assert.equal(directionFromInput(1, 0, 'left'), 'right')
  assert.equal(directionFromInput(0, 0, 'right'), 'right')
})

test('weapon drops require confirmation while potions remain automatic', () => {
  assert.equal(pickupIntent({ type: 'weapon.dungeon_blade' }), 'confirm')
  assert.equal(pickupIntent({ type: 'consumable.health_potion' }), 'auto')
  assert.equal(pickupIntent(null), 'ignore')
})

test('nearest weapon inside interaction radius wins without selecting potions', () => {
  const player = { x: 100, y: 100 }
  const farWeapon = { x: 132, y: 100, item: { type: 'weapon.dungeon_blade', damage: 8 } }
  const nearWeapon = { x: 112, y: 100, item: { type: 'weapon.dungeon_blade', damage: 11 } }
  const potion = { x: 104, y: 100, item: { type: 'consumable.health_potion' } }
  assert.equal(nearestConfirmableDrop(player, [farWeapon, potion, nearWeapon], 40), nearWeapon)
  assert.equal(nearestConfirmableDrop(player, [farWeapon], 20), null)
})

test('rarity presentation makes rare loot visually stronger', () => {
  assert.deepEqual(rarityPresentation('common'), { color: 0xf4f0e8, beamAlpha: 0.22, particles: 0 })
  assert.deepEqual(rarityPresentation('uncommon'), { color: 0x70ff9f, beamAlpha: 0.34, particles: 2 })
  assert.deepEqual(rarityPresentation('rare'), { color: 0x67a8ff, beamAlpha: 0.5, particles: 4 })
  assert.deepEqual(rarityPresentation('epic'), { color: 0xc984ff, beamAlpha: 0.68, particles: 7 })
})

test('clearing floors one through four opens a portal and floor five completes the run', () => {
  assert.equal(floorOutcome(1, 0), 'portal')
  assert.equal(floorOutcome(4, 0), 'portal')
  assert.equal(floorOutcome(5, 0), 'complete')
  assert.equal(floorOutcome(5, 1), 'combat')
})

test('five floors rotate through three authored room layouts', () => {
  assert.deepEqual([1, 2, 3, 4, 5].map(roomLayoutForFloor), ['pillars', 'cross', 'broken-hall', 'pillars', 'cross'])
})