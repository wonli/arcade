import test from 'node:test'
import assert from 'node:assert/strict'

import { parseTiledMap } from './tiled-map.js'

const sample = `<?xml version="1.0" encoding="UTF-8"?>
<map tilewidth="16" tileheight="16" infinite="1">
  <tileset firstgid="1" name="Water_coasts_animation" tilewidth="16" tileheight="16" tilecount="928" columns="29">
    <image source="Water_coasts_animation.png" width="464" height="512"/>
    <tile id="30"><animation>
      <frame tileid="30" duration="150"/>
      <frame tileid="44" duration="150"/>
    </animation></tile>
  </tileset>
  <tileset firstgid="3815" name="walls_floor" tilewidth="16" tileheight="16" tilecount="442" columns="17">
    <image source="walls_floor.png" width="272" height="416"/>
  </tileset>
  <layer id="49" name="floor2_dark" width="16" height="24">
    <data encoding="csv"><chunk x="-32" y="0" width="4" height="2">0,3815,3816,0,3815,3816,3816,0</chunk></data>
  </layer>
</map>`

test('parses Tiled tilesets, animation frames, and chunk gids', () => {
  const map = parseTiledMap(sample)
  assert.equal(map.tileWidth, 16)
  assert.equal(map.tileHeight, 16)
  assert.equal(map.tilesets.walls_floor.firstGid, 3815)
  assert.equal(map.tilesets.walls_floor.columns, 17)
  assert.equal(map.tilesets.walls_floor.image, 'walls_floor.png')
  assert.deepEqual(map.tilesets.Water_coasts_animation.animations['30'], [
    { tileId: 30, duration: 150 },
    { tileId: 44, duration: 150 },
  ])
  assert.deepEqual(map.layers.floor2_dark.chunks[0], {
    x: -32,
    y: 0,
    width: 4,
    height: 2,
    gids: [0, 3815, 3816, 0, 3815, 3816, 3816, 0],
  })
})

test('resolves global gids back to a tileset and local tile id', () => {
  const map = parseTiledMap(sample)
  assert.deepEqual(map.resolveGid(3815), { tileset: 'walls_floor', tileId: 0 })
  assert.deepEqual(map.resolveGid(3816), { tileset: 'walls_floor', tileId: 1 })
  assert.deepEqual(map.resolveGid(44), { tileset: 'Water_coasts_animation', tileId: 43 })
  assert.equal(map.resolveGid(0), null)
})

test('decodes Tiled transform flags before resolving a gid', () => {
  const map = parseTiledMap(sample)
  const horizontal3816 = 0x80000000 + 3816
  const vertical3816 = 0x40000000 + 3816
  const diagonal3816 = 0x20000000 + 3816

  assert.deepEqual(map.decodeGid(horizontal3816), {
    tileset: 'walls_floor', tileId: 1, flipX: true, flipY: false, flipDiagonal: false,
  })
  assert.deepEqual(map.decodeGid(vertical3816), {
    tileset: 'walls_floor', tileId: 1, flipX: false, flipY: true, flipDiagonal: false,
  })
  assert.deepEqual(map.decodeGid(diagonal3816), {
    tileset: 'walls_floor', tileId: 1, flipX: false, flipY: false, flipDiagonal: true,
  })
  assert.deepEqual(map.resolveGid(horizontal3816), { tileset: 'walls_floor', tileId: 1 })
})
