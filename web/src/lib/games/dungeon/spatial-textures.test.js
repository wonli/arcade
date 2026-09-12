import test from 'node:test'
import assert from 'node:assert/strict'

import { spatialTextureKey, spatialTextureTint, spatialTileStack } from './spatial-runtime.js'
import { roomGeometry } from './spatial.js'

const allTextures = {
  tilesetFloor: true,
  tilesetWall: true,
  tilesetWater: true,
  tilesetObstacle: true,
  tilesetTorch: true,
  tilesetChest: true,
}

test('wall-shaped room solids are classified as walls while pillars stay props', () => {
  const room = roomGeometry('cross-hall', 1, () => 0)
  const authored = room.solids.filter((solid) => solid.kind !== 'boundary')
  const wallShaped = authored.filter((solid) => solid.width > 50 || solid.height > 50)
  const pillars = authored.filter((solid) => solid.width <= 50 && solid.height <= 50)

  assert.ok(wallShaped.length > 0)
  assert.ok(wallShaped.every((solid) => solid.kind === 'wall'))
  assert.ok(pillars.length > 0)
  assert.ok(pillars.every((solid) => solid.kind === 'pillar'))
  assert.ok(wallShaped.every((solid) => spatialTextureKey(solid.kind, allTextures) === 'dungeon-tileset-wall'))
  assert.ok(pillars.every((solid) => spatialTextureKey(solid.kind, allTextures) === 'dungeon-tileset-obstacle'))
})

test('pillars render from the authored vertical tile stack', () => {
  const stacks = { obstacle: [188, 208, 228, 248] }
  assert.deepEqual(spatialTileStack('pillar', stacks), [188, 208, 228, 248])
  assert.equal(spatialTileStack('wall', stacks), null)
  assert.equal(spatialTileStack('boundary', stacks), null)
})

test('dedicated dungeon tiles preserve their authored palette', () => {
  assert.equal(spatialTextureTint('floor', 'dungeon-tileset-floor'), null)
  assert.equal(spatialTextureTint('wall', 'dungeon-tileset-wall'), null)
  assert.equal(spatialTextureTint('water', 'dungeon-tileset-water'), null)
  assert.equal(spatialTextureTint('pillar', 'dungeon-tileset-obstacle'), null)
  assert.equal(spatialTextureTint('wall', 'dungeon-wall'), 0x667488)
})
