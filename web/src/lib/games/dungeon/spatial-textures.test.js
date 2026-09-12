import test from 'node:test'
import assert from 'node:assert/strict'

import { spatialTextureKey } from './spatial-runtime.js'

const allTextures = {
  tilesetFloor: true,
  tilesetWall: true,
  tilesetWater: true,
  tilesetObstacle: true,
  tilesetTorch: true,
  tilesetChest: true,
}

test('wall-shaped solids use the wall tileset instead of repeating a column prop', () => {
  assert.equal(spatialTextureKey('boundary', allTextures), 'dungeon-tileset-wall')
  assert.equal(spatialTextureKey('wall', allTextures), 'dungeon-tileset-wall')
  assert.equal(spatialTextureKey('broken-wall', allTextures), 'dungeon-tileset-wall')
  assert.equal(spatialTextureKey('pillar-wall', allTextures), 'dungeon-tileset-wall')
  assert.equal(spatialTextureKey('pillar', allTextures), 'dungeon-tileset-obstacle')
})
