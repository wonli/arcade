import test from 'node:test'
import assert from 'node:assert/strict'

import { chooseEnvironmentAssets } from './environment-assets.js'

const manifest = {
  assets: [
    { source: 'dungeon-tileset', path: '/assets/dungeon-tileset/floor/stone-floor.png', kind: 'floor', width: 16, height: 16 },
    { source: 'dungeon-tileset', path: '/assets/dungeon-tileset/walls/stone-wall.png', kind: 'wall', width: 16, height: 32 },
    { source: 'dungeon-tileset', path: '/assets/dungeon-tileset/water/water.png', kind: 'water', width: 16, height: 16 },
    { source: 'dungeon-tileset', path: '/assets/dungeon-tileset/props/pillar.png', kind: 'obstacle', width: 16, height: 24 },
    { source: 'dungeon-tileset', path: '/assets/dungeon-tileset/props/torch.png', kind: 'torch', width: 16, height: 24 },
    { source: 'dungeon-tileset', path: '/assets/dungeon-tileset/props/chest.png', kind: 'chest', width: 24, height: 20 },
  ],
}

test('selects a complete environment from the dedicated dungeon tileset', () => {
  const assets = chooseEnvironmentAssets(manifest)
  assert.equal(assets.floor.source, 'dungeon-tileset')
  assert.equal(assets.wall.source, 'dungeon-tileset')
  assert.equal(assets.water.source, 'dungeon-tileset')
  assert.equal(assets.obstacle.source, 'dungeon-tileset')
  assert.equal(assets.torch.source, 'dungeon-tileset')
  assert.equal(assets.chest.source, 'dungeon-tileset')
  assert.notEqual(assets.floor.path, assets.wall.path)
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