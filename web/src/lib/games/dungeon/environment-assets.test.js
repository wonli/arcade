import test from 'node:test'
import assert from 'node:assert/strict'

import { chooseEnvironmentAssets } from './environment-assets.js'

const manifest = {
  assets: [
    { source: 'dungeon-tileset', path: '/assets/dungeon-tileset/Tiled_files/walls_floor.png', kind: 'wall', width: 272, height: 416, frames: 442, frameWidth: 16, frameHeight: 16 },
    { source: 'dungeon-tileset', path: '/assets/dungeon-tileset/Tiled_files/Water_coasts_animation.png', kind: 'water', width: 464, height: 512, frames: 928, frameWidth: 16, frameHeight: 16 },
    { source: 'dungeon-tileset', path: '/assets/dungeon-tileset/Tiled_files/Arches_columns.png', kind: 'obstacle', width: 320, height: 224, frames: 280, frameWidth: 16, frameHeight: 16 },
    { source: 'dungeon-tileset', path: '/assets/dungeon-tileset/Tiled_files/torches.png', kind: 'torch', width: 224, height: 288, frames: 252, frameWidth: 16, frameHeight: 16 },
    { source: 'dungeon-tileset', path: '/assets/dungeon-tileset/Tiled_files/chest_lever.png', kind: 'chest', width: 192, height: 176, frames: 132, frameWidth: 16, frameHeight: 16 },
  ],
}

const tiledManifest = {
  ...manifest,
  tiledMaps: {
    Dungeon3: {
      tilesets: {
        Water_coasts_animation: { name: 'Water_coasts_animation', firstGid: 1, tileCount: 928 },
        walls_floor: { name: 'walls_floor', firstGid: 3815, tileCount: 442 },
      },
      layers: {
        Floor: { chunks: [{ gids: [0, 3953, 3953, 3953, 3970, 3953] }] },
        Walls: { chunks: [{ gids: [3850, 3851, 3851, 3851, 3852, 3851, 0] }] },
        Water: { chunks: [{ gids: [0, 872, 872, 872, 872, 0] }] },
      },
    },
  },
}

test('selects a complete environment from the dedicated dungeon tileset', () => {
  const assets = chooseEnvironmentAssets(manifest)
  assert.equal(assets.floor.source, 'dungeon-tileset')
  assert.equal(assets.wall.source, 'dungeon-tileset')
  assert.equal(assets.water.source, 'dungeon-tileset')
  assert.equal(assets.obstacle.source, 'dungeon-tileset')
  assert.equal(assets.torch.source, 'dungeon-tileset')
  assert.equal(assets.chest.source, 'dungeon-tileset')
  assert.equal(assets.floor.path, assets.wall.path)
  assert.notEqual(assets.floor.frame, assets.wall.frame)
})

test('uses visible fallback tiles and authored prop composition without Tiled metadata', () => {
  const assets = chooseEnvironmentAssets(manifest)
  assert.equal(assets.floor.frame, 311)
  assert.equal(assets.wall.frame, 30)
  assert.equal(assets.obstacle.frameWidth, 16)
  assert.equal(assets.obstacle.frameHeight, 16)
  assert.deepEqual(assets.obstacle.tileStack, [188, 208, 228, 248])
  assert.deepEqual(assets.torch.region, { x: 0, y: 0, width: 48, height: 48 })
  assert.equal(assets.torch.frameWidth, 48)
  assert.equal(assets.torch.frameHeight, 48)
  assert.equal(assets.torch.frame, 0)
  assert.deepEqual(assets.chest.region, { x: 0, y: 0, width: 32, height: 32 })
  assert.equal(assets.chest.frameWidth, 32)
  assert.equal(assets.chest.frameHeight, 32)
  assert.equal(assets.chest.frame, 0)
})

test('derives representative floor wall and water frames from Dungeon3 authored layers', () => {
  const assets = chooseEnvironmentAssets(tiledManifest)
  assert.equal(assets.floor.frame, 138)
  assert.equal(assets.wall.frame, 36)
  assert.equal(assets.water.frame, 871)
  assert.equal(assets.floor.authoredBy, 'Dungeon3/Floor')
  assert.equal(assets.wall.authoredBy, 'Dungeon3/Walls')
  assert.equal(assets.water.authoredBy, 'Dungeon3/Water')
})

test('ignores Tiled transform flags when counting authored surface tiles', () => {
  const transformed = structuredClone(tiledManifest)
  transformed.tiledMaps.Dungeon3.layers.Floor.chunks[0].gids = [2147487601, 2147487601, 3953]
  const assets = chooseEnvironmentAssets(transformed)
  assert.equal(assets.floor.frame, 138)
})

test('never falls back to Debts environment when the dedicated tileset is present', () => {
  const assets = chooseEnvironmentAssets({
    assets: [
      ...manifest.assets,
      { source: 'debts', path: '/assets/debts/Tiles/Floor.png', kind: 'floor', width: 16, height: 16 },
      { source: 'debts', path: '/assets/debts/Tiles/Wall.png', kind: 'wall', width: 16, height: 16 },
    ],
  })
  assert.ok(Object.values(assets).filter(Boolean).every((asset) => asset.source === 'dungeon-tileset'))
})
