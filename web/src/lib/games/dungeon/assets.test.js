import test from 'node:test'
import assert from 'node:assert/strict'

import { describeDungeonAsset, describeRpgMainCharacterAsset } from './assets.js'
import { chooseDungeonAssets } from './scene.js'

test('describes the Debts wizard strip as four 26x18 animation frames', () => {
  assert.deepEqual(
    describeDungeonAsset('/assets/debts/Characters/Wizard.png', 182, 18),
    { frames: 4, frameWidth: 26, frameHeight: 18 },
  )
})

test('keeps regular four-frame creature sheets on their natural frame size', () => {
  assert.deepEqual(
    describeDungeonAsset('/assets/debts/Creatures/Slime.png', 64, 16),
    { frames: 4, frameWidth: 16, frameHeight: 16 },
  )
})

test('describes RPG main character idle and walk sheets as one four-frame row', () => {
  assert.deepEqual(
    describeRpgMainCharacterAsset('/assets/rpg-main-character/_down walk.png', 256, 128),
    { frames: 4, frameWidth: 64, frameHeight: 64, action: 'walk', direction: 'down' },
  )
})

test('describes RPG main character attack sheets as one two-frame row', () => {
  assert.deepEqual(
    describeRpgMainCharacterAsset('/assets/rpg-main-character/_side attack.png', 128, 128),
    { frames: 2, frameWidth: 64, frameHeight: 64, action: 'attack', direction: 'side' },
  )
})

test('selects dungeon textures for spatial floor walls obstacles torches and chests', () => {
  const asset = (path) => ({ path, source: 'debts', frames: 1, frameWidth: 16, frameHeight: 16, width: 16, height: 16 })
  const chosen = chooseDungeonAssets({
    assets: [
      asset('/assets/debts/Tiles/Floor Stone.png'),
      asset('/assets/debts/Tiles/Wall Brick.png'),
      asset('/assets/debts/Objects/Stone Column.png'),
      asset('/assets/debts/Objects/Torch.png'),
      asset('/assets/debts/Objects/Chest.png'),
    ],
  })

  assert.match(chosen.floor.path, /Floor Stone/)
  assert.match(chosen.wall.path, /Wall Brick/)
  assert.match(chosen.obstacle.path, /Stone Column/)
  assert.match(chosen.torch.path, /Torch/)
  assert.match(chosen.chest.path, /Chest/)
})
