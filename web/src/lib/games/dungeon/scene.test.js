import test from 'node:test'
import assert from 'node:assert/strict'

import { chooseDungeonAssets, directionFromInput } from './scene.js'

const manifest = {
  assets: [
    { path: '/assets/rpg/main.png', width: 512, height: 512, frames: 1, frameWidth: 512, frameHeight: 512, source: 'rpg-main-character' },
    { path: '/assets/debts/Creatures/Slime.png', width: 64, height: 16, frames: 4, frameWidth: 16, frameHeight: 16, source: 'debts' },
    { path: '/assets/debts/Tiles/BrickFloor.png', width: 16, height: 16, frames: 1, frameWidth: 16, frameHeight: 16, source: 'debts' },
    { path: '/assets/debts/Tiles/StoneWall.png', width: 16, height: 16, frames: 1, frameWidth: 16, frameHeight: 16, source: 'debts' },
    { path: '/assets/debts/Items/Sword.png', width: 16, height: 16, frames: 1, frameWidth: 16, frameHeight: 16, source: 'debts' },
  ],
}

test('prefers the new RPG main character while keeping old dungeon assets', () => {
  const assets = chooseDungeonAssets(manifest)
  assert.equal(assets.player.source, 'rpg-main-character')
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
