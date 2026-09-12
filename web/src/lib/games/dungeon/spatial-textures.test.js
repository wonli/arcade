import test from 'node:test'
import assert from 'node:assert/strict'

import { spatialAnimation, spatialFloorAutotile, spatialTextureKey, spatialTileStack, spatialWallMotif, spatialPropRotation } from './spatial-runtime.js'
import { roomGeometry } from './spatial.js'
import { parseTiledMap } from './tiled-map.js'

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

test('preserves duplicate Tiled layers instead of overwriting floor2_dark', () => {
  const xml = `<map tilewidth="16" tileheight="16" infinite="1">
    <tileset firstgid="3815" name="walls_floor" tilewidth="16" tileheight="16" tilecount="442" columns="17"><image source="walls_floor.png" width="272" height="416"/></tileset>
    <layer id="49" name="floor2_dark" width="2" height="1"><data encoding="csv">4207,4208</data></layer>
    <layer id="76" name="floor2_dark" width="2" height="1"><data encoding="csv">4224,4225</data></layer>
  </map>`
  const map = parseTiledMap(xml)
  assert.equal(map.layerGroups.floor2_dark.length, 2)
  assert.equal(map.layerGroups.floor2_dark[0].id, 49)
  assert.equal(map.layerGroups.floor2_dark[1].id, 76)
})

test('floor exposes the authored Dungeon3 dark-edge autotile', () => {
  const autotile = {
    topLeft: 375, top: 376, topRight: 377,
    left: 392, center: 393, right: 394,
    bottomLeft: 409, bottom: 410, bottomRight: 411,
  }
  assert.deepEqual(spatialFloorAutotile({ floor: autotile }), autotile)
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
