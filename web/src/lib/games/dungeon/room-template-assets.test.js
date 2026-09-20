import test from 'node:test'
import assert from 'node:assert/strict'

import { dungeon3Rules } from './dungeon3-rules.js'
import { listDungeon3RoomAssets } from './room-template-assets.js'

test('catalog exposes authored walls, doors, water, stairs and both bridge families', () => {
  const assets = listDungeon3RoomAssets()
  const keys = new Set(assets.map((asset) => asset.key))

  for (const key of [
    'wall.vertical.west',
    'wall.vertical.east',
    'wall.vertical.body',
    'wall.horizontal',
    'door.closed',
    'door.open',
    'water.body',
    'stairs.default',
    'bridge.flat',
    'bridge.arch',
  ]) assert.ok(keys.has(key), `missing ${key}`)

  const arch = assets.find((asset) => asset.key === 'bridge.arch')
  assert.equal(arch.semantic, 'water-bridge-arch')
  assert.ok(arch.cells.length > 0)
  assert.ok(arch.cells.every((cell) => cell.tileset === 'Arches_columns'))

  for (const asset of assets) {
    assert.ok(asset.image.startsWith('/assets/dungeon-tileset/'))
    assert.ok(Number.isInteger(asset.columns) && asset.columns > 0)
    assert.ok(Array.isArray(asset.allowedRotations))
    for (const cell of asset.cells) {
      const tileset = dungeon3Rules.tilesets[cell.tileset]
      assert.ok(tileset, `${asset.key} references missing ${cell.tileset}`)
      assert.ok(cell.tileId >= 0 && cell.tileId < tileset.tileCount, `${asset.key} references invalid tile`)
    }
  }
})
