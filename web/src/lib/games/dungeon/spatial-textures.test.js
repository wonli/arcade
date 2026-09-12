import test from 'node:test'
import assert from 'node:assert/strict'

import { spatialAnimation, spatialTextureKey, spatialTileStack, spatialWallMotif, spatialPropRotation } from './spatial-runtime.js'
import { roomGeometry } from './spatial.js'

const allTextures = {
  tilesetFloor: true,
  tilesetWall: true,
  tilesetWater: true,
  tilesetWaterDetail: true,
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

test('pillars render from the authored vertical tile stack and rotate as one prop', () => {
  const stacks = { obstacle: [188, 208, 228, 248] }
  assert.deepEqual(spatialTileStack('pillar', stacks), [188, 208, 228, 248])
  assert.equal(spatialTileStack('wall', stacks), null)
  assert.equal(spatialTileStack('boundary', stacks), null)
  assert.equal(spatialPropRotation('pillar', { obstacle: 90 }), 90)
  assert.equal(spatialPropRotation('wall', { obstacle: 90 }), 0)
})

test('walls expose the authored Dungeon3 multi-texture motif', () => {
  const motif = { width: 2, height: 2, cells: [{ texture: 'wall', frame: 1 }, { texture: 'obstacle', frame: 2 }] }
  assert.equal(spatialWallMotif('wall', { wall: motif }), motif)
  assert.equal(spatialWallMotif('boundary', { wall: motif }), motif)
  assert.equal(spatialWallMotif('pillar', { wall: motif }), null)
})

test('water detail uses its own Tiled texture and authored animation timing', () => {
  const animation = [
    { tileId: 325, duration: 150 },
    { tileId: 806, duration: 150 },
    { tileId: 1287, duration: 150 },
  ]
  assert.equal(spatialTextureKey('water-detail', allTextures), 'dungeon-tileset-water-detail')
  assert.deepEqual(spatialAnimation('water-detail', { waterDetail: animation }), animation)
  assert.equal(spatialAnimation('water', { waterDetail: animation }), null)
})
