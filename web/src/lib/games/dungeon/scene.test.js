import test from 'node:test'
import assert from 'node:assert/strict'

import { chooseDungeonAssets } from './scene.js'

const manifest = {
  assets: [
    { path: '/assets/debts/Characters/Wizard.png', width: 182, height: 18, frames: 1, frameWidth: 182, frameHeight: 18 },
    { path: '/assets/debts/Creatures/Slime.png', width: 64, height: 16, frames: 4, frameWidth: 16, frameHeight: 16 },
    { path: '/assets/debts/Tiles/BrickFloor.png', width: 16, height: 16, frames: 1, frameWidth: 16, frameHeight: 16 },
    { path: '/assets/debts/Tiles/StoneWall.png', width: 16, height: 16, frames: 1, frameWidth: 16, frameHeight: 16 },
    { path: '/assets/debts/Items/Sword.png', width: 16, height: 16, frames: 1, frameWidth: 16, frameHeight: 16 },
  ],
}

test('uses the wizard source frame size instead of rendering the full strip', () => {
  const assets = chooseDungeonAssets(manifest)

  assert.equal(assets.player.path, '/assets/debts/Characters/Wizard.png')
  assert.equal(assets.player.frames, 7)
  assert.equal(assets.player.frameWidth, 26)
  assert.equal(assets.player.frameHeight, 18)
  assert.equal(assets.player.animationFrames, 4)
})

test('chooses dungeon presentation assets without changing enemy framing', () => {
  const assets = chooseDungeonAssets(manifest)

  assert.equal(assets.enemy.path, '/assets/debts/Creatures/Slime.png')
  assert.equal(assets.enemy.frames, 4)
  assert.equal(assets.floor.path, '/assets/debts/Tiles/BrickFloor.png')
  assert.equal(assets.wall.path, '/assets/debts/Tiles/StoneWall.png')
  assert.equal(assets.weapon.path, '/assets/debts/Items/Sword.png')
})

test('keeps the wizard frame aspect ratio instead of forcing square dimensions', () => {
  const assets = chooseDungeonAssets(manifest)
  assert.equal(assets.player.frameWidth / assets.player.frameHeight, 26 / 18)
})
