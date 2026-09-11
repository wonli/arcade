import test from 'node:test'
import assert from 'node:assert/strict'

import { chooseDungeonAssets } from './scene.js'

const manifest = {
  assets: [
    { path: '/assets/debts/Characters/Wizard.png', width: 64, height: 24, frames: 4, frameWidth: 16, frameHeight: 24 },
    { path: '/assets/debts/Creatures/Slime.png', width: 64, height: 16, frames: 4, frameWidth: 16, frameHeight: 16 },
    { path: '/assets/debts/Tiles/BrickFloor.png', width: 16, height: 16, frames: 1, frameWidth: 16, frameHeight: 16 },
    { path: '/assets/debts/Tiles/StoneWall.png', width: 16, height: 16, frames: 1, frameWidth: 16, frameHeight: 16 },
    { path: '/assets/debts/Items/Sword.png', width: 16, height: 16, frames: 1, frameWidth: 16, frameHeight: 16 },
  ],
}

test('chooses animated actor sheets and dungeon presentation assets', () => {
  const assets = chooseDungeonAssets(manifest)

  assert.equal(assets.player.path, '/assets/debts/Characters/Wizard.png')
  assert.equal(assets.player.frames, 4)
  assert.equal(assets.player.frameWidth, 16)
  assert.equal(assets.player.frameHeight, 24)
  assert.equal(assets.enemy.path, '/assets/debts/Creatures/Slime.png')
  assert.equal(assets.floor.path, '/assets/debts/Tiles/BrickFloor.png')
  assert.equal(assets.wall.path, '/assets/debts/Tiles/StoneWall.png')
  assert.equal(assets.weapon.path, '/assets/debts/Items/Sword.png')
})

test('keeps actor frame aspect ratio instead of forcing square dimensions', () => {
  const assets = chooseDungeonAssets(manifest)
  assert.equal(assets.player.frameWidth / assets.player.frameHeight, 2 / 3)
})
