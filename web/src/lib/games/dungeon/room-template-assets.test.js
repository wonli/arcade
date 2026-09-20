import test from 'node:test'
import assert from 'node:assert/strict'

import { dungeon3Rules } from './dungeon3-rules.js'
import { listDungeon3RoomAssets } from './room-template-assets.js'

test('catalog exposes authored walls, doors, water, stairs and both bridge families', () => {
  const assets = listDungeon3RoomAssets()
  const keys = new Set(assets.map((asset) => asset.key))

  assert.ok(assets.length >= 100, `catalog unexpectedly contains only ${assets.length} assets`)

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

  for (const key of ['assembly.statue', 'assembly.floorTrap', 'coffin.01', 'object.01', 'candle.01', 'relief.01', 'plate.01', 'stairs-variant.01', 'door-variant.01', 'water.coast.nw', 'water.sheen.01']) {
    assert.ok(keys.has(key), `missing extended resource ${key}`)
  }

  const wallWest = assets.find((asset) => asset.key === 'wall.vertical.west')
  const wallEast = assets.find((asset) => asset.key === 'wall.vertical.east')
  const wallBody = assets.find((asset) => asset.key === 'wall.vertical.body')
  assert.equal(wallWest.width, 1)
  assert.equal(wallEast.width, 1)
  assert.equal(wallWest.height, 6)
  assert.equal(wallEast.height, 6)
  assert.equal(wallWest.source.x, -11)
  assert.equal(wallEast.source.x, -8)
  assert.deepEqual(wallWest.cells.map((cell) => cell.tileId), [209, 226, 243, 261, 278, 295])
  assert.deepEqual(wallEast.cells.map((cell) => cell.tileId), [210, 227, 244, 260, 277, 294])
  assert.ok(wallWest.cells.every((cell) => cell.x === 0), 'west edge must not include the adjacent body column')
  assert.ok(wallEast.cells.every((cell) => cell.x === 0), 'east edge must not include the adjacent body column')
  assert.equal(wallBody.width, 1)
})

test('Arches_columns assets are marked as a dedicated selectable palette family', () => {
  const assets = listDungeon3RoomAssets()
  const archAssets = assets.filter((asset) => asset.paletteGroup === 'arches')

  assert.ok(archAssets.length >= 8, 'Arches_columns combinations should have their own palette family')
  assert.ok(archAssets.every((asset) => asset.cells.every((cell) => cell.tileset === 'Arches_columns')))
  assert.ok(archAssets.every((asset) => asset.width > 1 || asset.height > 1), 'palette should expose complete combinations, not transparent single cells')
})
