import test from 'node:test'
import assert from 'node:assert/strict'

import { chooseEnvironmentAssets } from './environment-assets.js'

const manifest = {
  assets: [
    { source: 'dungeon-tileset', path: '/assets/dungeon-tileset/Tiled_files/walls_floor.png', kind: 'wall', width: 272, height: 416, frames: 442, frameWidth: 16, frameHeight: 16 },
    { source: 'dungeon-tileset', path: '/assets/dungeon-tileset/Tiled_files/Water_coasts_animation.png', kind: 'water', width: 464, height: 512, frames: 928, frameWidth: 16, frameHeight: 16 },
    { source: 'dungeon-tileset', path: '/assets/dungeon-tileset/Tiled_files/water_details_animation.png', kind: 'water', width: 592, height: 1248, frames: 2886, frameWidth: 16, frameHeight: 16 },
    { source: 'dungeon-tileset', path: '/assets/dungeon-tileset/Tiled_files/Arches_columns.png', kind: 'obstacle', width: 320, height: 224, frames: 280, frameWidth: 16, frameHeight: 16 },
    { source: 'dungeon-tileset', path: '/assets/dungeon-tileset/Tiled_files/plates.png', kind: 'floor', width: 208, height: 128, frames: 104, frameWidth: 16, frameHeight: 16 },
    { source: 'dungeon-tileset', path: '/assets/dungeon-tileset/Tiled_files/stairs.png', kind: 'floor', width: 272, height: 304, frames: 323, frameWidth: 16, frameHeight: 16 },
    { source: 'dungeon-tileset', path: '/assets/dungeon-tileset/Tiled_files/doors.png', kind: 'floor', width: 128, height: 288, frames: 144, frameWidth: 16, frameHeight: 16 },
    { source: 'dungeon-tileset', path: '/assets/dungeon-tileset/Tiled_files/Statue_fire.png', kind: 'obstacle', width: 480, height: 80, frames: 150, frameWidth: 16, frameHeight: 16 },
    { source: 'dungeon-tileset', path: '/assets/dungeon-tileset/Tiled_files/coffins.png', kind: 'floor', width: 480, height: 160, frames: 300, frameWidth: 16, frameHeight: 16 },
    { source: 'dungeon-tileset', path: '/assets/dungeon-tileset/Tiled_files/other_objects.png', kind: 'floor', width: 192, height: 384, frames: 288, frameWidth: 16, frameHeight: 16 },
    { source: 'dungeon-tileset', path: '/assets/dungeon-tileset/Tiled_files/plate_trap.png', kind: 'floor', width: 384, height: 64, frames: 96, frameWidth: 16, frameHeight: 16 },
    { source: 'dungeon-tileset', path: '/assets/dungeon-tileset/Tiled_files/Spikes.png', kind: 'floor', width: 288, height: 80, frames: 90, frameWidth: 16, frameHeight: 16 },
    { source: 'dungeon-tileset', path: '/assets/dungeon-tileset/Tiled_files/candles.png', kind: 'torch', width: 432, height: 224, frames: 378, frameWidth: 16, frameHeight: 16 },
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
        Water_detilazation: {
          name: 'Water_detilazation', firstGid: 929, tileCount: 2886,
          animations: { '325': [{ tileId: 325, duration: 150 }, { tileId: 806, duration: 150 }, { tileId: 1287, duration: 150 }, { tileId: 1768, duration: 150 }, { tileId: 2249, duration: 150 }, { tileId: 2730, duration: 150 }] },
        },
        walls_floor: { name: 'walls_floor', firstGid: 3815, tileCount: 442 },
        Arches_columns: { name: 'Arches_columns', firstGid: 4257, tileCount: 280 },
        plates: { name: 'plates', firstGid: 4537, tileCount: 104 },
      },
      layers: {
        Floor: { chunks: [{ x: 0, y: 0, width: 6, height: 1, gids: [0, 3953, 3953, 3953, 3970, 3953] }] },
        floor1_details: { chunks: [{ x: 0, y: 0, width: 6, height: 1, gids: [4216, 4218, 4219, 4233, 4234, 0] }] },
        plates1: { chunks: [{ x: 0, y: 0, width: 8, height: 1, gids: [4552, 4539, 4620, 4633, 4602, 4542, 4552, 4539] }] },
        Walls: { chunks: [{ x: 0, y: 0, width: 6, height: 2, gids: [3837, 3842, 4278, 4279, 3868, 3843, 3844, 3845, 4298, 4299, 3885, 3847] }] },
        Water: { chunks: [{ x: 0, y: 0, width: 6, height: 1, gids: [0, 872, 872, 872, 872, 0] }] },
        Water_details: { chunks: [{ x: 0, y: 0, width: 6, height: 1, gids: [0, 1254, 1254, 1254, 1254, 0] }] },
      },
      layerGroups: {
        floor2_dark: [{ chunks: [{ x: 0, y: 0, width: 6, height: 3, gids: [4190,4191,4191,4191,4191,4192,4207,4208,4208,4208,4208,4209,4224,4225,4225,4225,4225,4226] }] }],
        Floor1_dark: [],
        floor1_details: [{ chunks: [{ x: 0, y: 0, width: 6, height: 1, gids: [4216, 4218, 4219, 4233, 4234, 0] }] }],
        plates1: [{ chunks: [{ x: 0, y: 0, width: 8, height: 1, gids: [4552, 4539, 4620, 4633, 4602, 4542, 4552, 4539] }] }],
      },
    },
  },
}

test('selects a complete environment from the dedicated dungeon tileset', () => {
  const assets = chooseEnvironmentAssets(manifest)
  for (const kind of ['floor', 'wall', 'water', 'obstacle', 'torch', 'chest']) assert.equal(assets[kind].source, 'dungeon-tileset')
  assert.equal(assets.floor.path, assets.wall.path)
  assert.notEqual(assets.floor.frame, assets.wall.frame)
})

test('uses visible fallback tiles and authored prop composition without Tiled metadata', () => {
  const assets = chooseEnvironmentAssets(manifest)
  assert.equal(assets.floor.frame, 311)
  assert.equal(assets.wall.frame, 30)
  assert.deepEqual(assets.obstacle.tileStack, [188, 208, 228, 248])
  assert.equal(assets.obstacle.rotation, 90)
  assert.deepEqual(assets.torch.region, { x: 0, y: 0, width: 48, height: 48 })
  assert.equal(assets.torch.frameWidth, 48)
  assert.deepEqual(assets.chest.region, { x: 0, y: 0, width: 32, height: 32 })
  assert.equal(assets.chest.frameWidth, 32)
})

test('exposes Dungeon3 bridge stairs doors props traps and light variants', () => {
  const assets = chooseEnvironmentAssets(manifest)
  for (const kind of ['bridge', 'pathPlate', 'arches', 'stairs', 'door', 'statue', 'coffin', 'objectDecoration', 'trapPlate', 'trapSpikes', 'candles']) {
    assert.equal(assets[kind]?.source, 'dungeon-tileset', `${kind} missing`)
    assert.ok(Array.isArray(assets[kind]?.frameset) && assets[kind].frameset.length > 0, `${kind} frameset missing`)
  }
  assert.equal(assets.bridge.path.endsWith('/Tiled_files/Arches_columns.png'), true)
  assert.ok(assets.bridge.frameset.every((frame) => frame >= 135), 'bridge should come from the right-side Arches_columns platform tiles')
  assert.ok(Array.isArray(assets.torch.variants) && assets.torch.variants.length > 1)
})

test('chest exposes a finite opening sequence and persistent open frame', () => {
  const assets = chooseEnvironmentAssets(manifest)
  assert.deepEqual(assets.chest.animation.map((entry) => entry.tileId), [0, 1, 2, 3, 4, 5])
  assert.equal(assets.chest.openFrame, 5)
})

test('keeps the opaque Floor base and layers authored dark edges and sparse details above it', () => {
  const assets = chooseEnvironmentAssets(tiledManifest)
  assert.equal(assets.floor.frame, 138)
  assert.equal(assets.floor.authoredBy, 'Dungeon3/Floor')
  assert.deepEqual(assets.floor.autotile, { topLeft: 375, top: 376, topRight: 377, left: 392, center: 393, right: 394, bottomLeft: 409, bottom: 410, bottomRight: 411 })
  assert.deepEqual(assets.floor.detailFrames, [401, 403, 404, 418, 419])
})

test('derives floor decorations from Dungeon3 plates1', () => {
  const assets = chooseEnvironmentAssets(tiledManifest)
  assert.equal(assets.floorDecoration.path.endsWith('/Tiled_files/plates.png'), true)
  assert.deepEqual(assets.floorDecoration.frameset, [15, 2, 83, 96, 65, 5])
  assert.equal(assets.floorDecoration.authoredBy, 'Dungeon3/plates1')
})

test('derives water frames while preserving an authored multi-tile wall motif', () => {
  const assets = chooseEnvironmentAssets(tiledManifest)
  assert.equal(assets.water.frame, 871)
  assert.equal(assets.water.authoredBy, 'Dungeon3/Water')
  assert.deepEqual(assets.water.coastFrames, [871])
  assert.equal(assets.wall.frame, 30)
  assert.equal(assets.wall.authoredBy, 'Dungeon3/Walls')
  assert.deepEqual(assets.wall.motif, {
    width: 6, height: 2,
    cells: [
      { texture: 'wall', frame: 22 }, { texture: 'wall', frame: 27 }, { texture: 'obstacle', frame: 21 }, { texture: 'obstacle', frame: 22 }, { texture: 'wall', frame: 53 }, { texture: 'wall', frame: 28 },
      { texture: 'wall', frame: 29 }, { texture: 'wall', frame: 30 }, { texture: 'obstacle', frame: 41 }, { texture: 'obstacle', frame: 42 }, { texture: 'wall', frame: 70 }, { texture: 'wall', frame: 32 },
    ],
  })
})

test('derives animated water detail from Dungeon3 instead of inventing frame timing', () => {
  const assets = chooseEnvironmentAssets(tiledManifest)
  assert.equal(assets.waterDetail.frame, 325)
  assert.deepEqual(assets.waterDetail.animation, [{ tileId: 325, duration: 150 }, { tileId: 806, duration: 150 }, { tileId: 1287, duration: 150 }, { tileId: 1768, duration: 150 }, { tileId: 2249, duration: 150 }, { tileId: 2730, duration: 150 }])
})

test('ignores Tiled transform flags when counting authored surface tiles', () => {
  const transformed = structuredClone(tiledManifest)
  transformed.tiledMaps.Dungeon3.layers.Floor.chunks[0].gids = [2147487601, 2147487601, 3953]
  const assets = chooseEnvironmentAssets(transformed)
  assert.equal(assets.floor.frame, 138)
})

test('never falls back to Debts environment when the dedicated tileset is present', () => {
  const assets = chooseEnvironmentAssets({ assets: [...manifest.assets, { source: 'debts', path: '/assets/debts/Tiles/Floor.png', kind: 'floor', width: 16, height: 16 }, { source: 'debts', path: '/assets/debts/Tiles/Wall.png', kind: 'wall', width: 16, height: 16 }] })
  assert.ok(Object.values(assets).filter(Boolean).every((asset) => asset.source === 'dungeon-tileset'))
})