import test from 'node:test'
import assert from 'node:assert/strict'

import { chooseDungeonAssets, directionFromInput } from './scene.js'

const manifest = {
  assets: [
    { path: '/assets/rpg-main-character/_down idle.png', width: 256, height: 128, frames: 8, frameWidth: 64, frameHeight: 64, source: 'rpg-main-character', action: 'idle', direction: 'down' },
    { path: '/assets/rpg-main-character/_down walk.png', width: 256, height: 128, frames: 8, frameWidth: 64, frameHeight: 64, source: 'rpg-main-character', action: 'walk', direction: 'down' },
    { path: '/assets/rpg-main-character/_down attack.png', width: 128, height: 128, frames: 4, frameWidth: 64, frameHeight: 64, source: 'rpg-main-character', action: 'attack', direction: 'down' },
    { path: '/assets/rpg-main-character/_side idle.png', width: 256, height: 128, frames: 8, frameWidth: 64, frameHeight: 64, source: 'rpg-main-character', action: 'idle', direction: 'side' },
    { path: '/assets/rpg-main-character/_side walk.png', width: 256, height: 128, frames: 8, frameWidth: 64, frameHeight: 64, source: 'rpg-main-character', action: 'walk', direction: 'side' },
    { path: '/assets/rpg-main-character/_side attack.png', width: 128, height: 128, frames: 4, frameWidth: 64, frameHeight: 64, source: 'rpg-main-character', action: 'attack', direction: 'side' },
    { path: '/assets/rpg-main-character/_up idle.png', width: 256, height: 128, frames: 8, frameWidth: 64, frameHeight: 64, source: 'rpg-main-character', action: 'idle', direction: 'up' },
    { path: '/assets/rpg-main-character/_up walk.png', width: 256, height: 128, frames: 8, frameWidth: 64, frameHeight: 64, source: 'rpg-main-character', action: 'walk', direction: 'up' },
    { path: '/assets/rpg-main-character/_up attack.png', width: 128, height: 128, frames: 4, frameWidth: 64, frameHeight: 64, source: 'rpg-main-character', action: 'attack', direction: 'up' },
    { path: '/assets/debts/Creatures/Slime.png', width: 64, height: 16, frames: 4, frameWidth: 16, frameHeight: 16, source: 'debts' },
    { path: '/assets/debts/Tiles/BrickFloor.png', width: 16, height: 16, frames: 1, frameWidth: 16, frameHeight: 16, source: 'debts' },
    { path: '/assets/debts/Tiles/StoneWall.png', width: 16, height: 16, frames: 1, frameWidth: 16, frameHeight: 16, source: 'debts' },
    { path: '/assets/debts/Items/Sword.png', width: 16, height: 16, frames: 1, frameWidth: 16, frameHeight: 16, source: 'debts' },
  ],
}

test('prefers the new RPG main character while keeping old dungeon assets', () => {
  const assets = chooseDungeonAssets(manifest)
  assert.equal(assets.player.source, 'rpg-main-character')
  assert.equal(assets.player.down.walk.path, '/assets/rpg-main-character/_down walk.png')
  assert.equal(assets.player.side.attack.frames, 4)
  assert.equal(assets.enemy.source, 'debts')
  assert.equal(assets.floor.source, 'debts')
  assert.equal(assets.wall.source, 'debts')
  assert.equal(assets.weapon.source, 'debts')
})

test('resolves movement into four player directions', () => {
  assert.equal(directionFromInput(0, -1, 'down'), 'up')
  assert.equal(directionFromInput(0, 1, 'up'), 'down')
  assert.equal(directionFromInput(-1, 0, 'down'), 'left')
  assert.equal(directionFromInput(1, 0, 'left'), 'right')
  assert.equal(directionFromInput(0, 0, 'right'), 'right')
})
