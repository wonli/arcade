import test from 'node:test'
import assert from 'node:assert/strict'

import { describeDungeonAsset, describeRpgMainCharacterAsset } from './assets.js'

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

test('spatial renderer keeps floor walls and obstacles on distinct texture roles', async () => {
  const runtime = await import('./spatial-runtime.js')
  assert.equal(typeof runtime.spatialTextureKey, 'function')
  assert.equal(runtime.spatialTextureKey('floor', { floor: true, wall: true, obstacle: true }), 'dungeon-floor')
  assert.equal(runtime.spatialTextureKey('boundary', { floor: true, wall: true, obstacle: true }), 'dungeon-wall')
  assert.equal(runtime.spatialTextureKey('pillar', { floor: true, wall: true, obstacle: true }), 'dungeon-obstacle')
  assert.equal(runtime.spatialTextureKey('broken-wall', { floor: true, wall: true, obstacle: true }), 'dungeon-obstacle')
  assert.equal(runtime.spatialTextureKey('pillar', { floor: true, wall: true, obstacle: false }), null)
  assert.equal(runtime.spatialTextureKey('floor', { floor: false, wall: true, obstacle: true }), null)
})

test('floor walls and obstacles have deliberately different visual tones', async () => {
  const runtime = await import('./spatial-runtime.js')
  assert.equal(typeof runtime.spatialSurfaceTint, 'function')
  const floor = runtime.spatialSurfaceTint('floor')
  const wall = runtime.spatialSurfaceTint('boundary')
  const obstacle = runtime.spatialSurfaceTint('pillar')
  assert.notEqual(floor, wall)
  assert.notEqual(wall, obstacle)
  assert.notEqual(floor, obstacle)
})

test('selects Debts environment sprites for obstacles torches and chests', async () => {
  const runtime = await import('./spatial-runtime.js')
  assert.equal(typeof runtime.selectDebtsEnvironmentAssets, 'function')
  const selected = runtime.selectDebtsEnvironmentAssets({
    assets: [
      { path: '/assets/debts/Tiles/BrickFloor.png', source: 'debts', frames: 1 },
      { path: '/assets/debts/Tiles/StoneWall.png', source: 'debts', frames: 1 },
      { path: '/assets/debts/Environment/Pillar.png', source: 'debts', frames: 1 },
      { path: '/assets/debts/Environment/Torch.png', source: 'debts', frames: 1 },
      { path: '/assets/debts/Items/Chest.png', source: 'debts', frames: 1 },
    ],
  })
  assert.equal(selected.obstacle.path, '/assets/debts/Environment/Pillar.png')
  assert.equal(selected.torch.path, '/assets/debts/Environment/Torch.png')
  assert.equal(selected.chest.path, '/assets/debts/Items/Chest.png')
})
