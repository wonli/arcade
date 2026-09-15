import test from 'node:test'
import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import { dungeon3Rules } from './dungeon3-rules.js'
import { extractDungeon3Rules, sourcePath } from '../../../../../scripts/extract-dungeon3-rules.mjs'

const sourceAvailable = existsSync(sourcePath)
const localSourceOnly = sourceAvailable ? false : 'Dungeon3.tmx lives under gitignored web/static/assets and is only available in local asset workspaces'

test('Dungeon3 compiled rules keep reproducible source provenance in the repository artifact', () => {
  assert.equal(dungeon3Rules.version, 1)
  assert.equal(dungeon3Rules.provenance.source, 'Tiled_files/Dungeon3.tmx')
  assert.match(dungeon3Rules.provenance.sha256, /^[a-f0-9]{64}$/)
  assert.equal(dungeon3Rules.provenance.tileWidth, 16)
  assert.equal(dungeon3Rules.provenance.tileHeight, 16)
})

test('Dungeon3 compiled rules reproduce from the local source TMX', { skip: localSourceOnly }, () => {
  assert.deepEqual(dungeon3Rules, extractDungeon3Rules(readFileSync(sourcePath, 'utf8')))
})

test('coast tiles describe land above water with a separate south cliff foot', () => {
  assert.equal(dungeon3Rules.water.body.tileId, 871)
  assert.deepEqual(['nw','n','ne','w','center','e','sw','s','se'].map(k=>dungeon3Rules.water.coast[k].tileId), [175,176,177,204,205,206,233,234,235])
  assert.deepEqual(dungeon3Rules.water.southFoot.map(t=>t.tileId), [262,263,264])
})

test('motifs retain complete multi-tile geometry, flips and source coordinates', () => {
  for (const group of Object.values(dungeon3Rules.motifs)) for (const motif of group) {
    assert.ok(motif.cells.length)
    for (const cell of motif.cells) {
      assert.ok(cell.x >= 0 && cell.x < motif.width && cell.y >= 0 && cell.y < motif.height)
      assert.equal(typeof cell.flipX, 'boolean')
      assert.equal(typeof cell.flipY, 'boolean')
      assert.equal(typeof cell.flipDiagonal, 'boolean')
    }
  }
  assert.ok(dungeon3Rules.motifs.coffins.some(m=>m.width===5 && m.height===3 && m.cells.length===15))
  assert.ok(dungeon3Rules.motifs.coffins.some(m=>m.cells.some(c=>c.flipX)))
  assert.ok(dungeon3Rules.motifs.otherObjects.some(m=>m.height>=3))
  assert.equal(dungeon3Rules.floorSkins.length,3)
  assert.ok(dungeon3Rules.tilesets.Water_coasts_animation.animations['175'].length > 1)
})

test('dark floor and shoreline motifs retain authored spatial evidence', { skip: localSourceOnly }, async () => {
  const { parseTiledMap } = await import('./tiled-map.js')
  const map = parseTiledMap(readFileSync(sourcePath, 'utf8'))
  function at(layerName, x, y) {
    for (const layer of map.layerGroups[layerName] ?? []) for (const chunk of layer.chunks) {
      if (x >= chunk.x && x < chunk.x + chunk.width && y >= chunk.y && y < chunk.y + chunk.height) {
        const ref = map.decodeGid(chunk.gids[(y-chunk.y)*chunk.width+x-chunk.x])
        if (ref) return ref
      }
    }
    return null
  }
  const darkEvidence = {nw:['Floor1_dark',-13,3],n:['Floor1_dark',-12,3],ne:['floor2_dark',1,10],w:['Floor1_dark',-13,4],center:['Floor1_dark',-12,4],e:['Floor1_dark',-10,4],sw:['Floor1_dark',-13,5],s:['Floor1_dark',-12,5],se:['Floor1_dark',-10,5]}
  for (const [key,position] of Object.entries(darkEvidence)) assert.deepEqual(dungeon3Rules.floorDark[key],at(...position))
  // This left shoreline is a vertical run, with empty west cells and filled east cells.
  for (const [key,y] of [['nw',3],['w',4],['sw',5]]) {
    assert.deepEqual(dungeon3Rules.water.coast[key],at('Floor',-13,y))
    assert.equal(at('Floor',-14,y),null)
    assert.ok(at('Floor',-12,y))
  }
  for (const [key,y] of [['ne',3],['e',4],['se',5]]) {
    assert.deepEqual(dungeon3Rules.water.coast[key],at('Floor',5,y))
    assert.equal(at('Floor',6,y),null)
    assert.ok(at('Floor',4,y))
  }
  assert.deepEqual(dungeon3Rules.water.coast.n,at('Floor',-12,3))
  assert.deepEqual(dungeon3Rules.water.coast.center,at('Floor',-12,4))
  assert.deepEqual(dungeon3Rules.water.coast.s,at('Floor',-10,6))
  assert.deepEqual(dungeon3Rules.water.southFoot[0],at('Floor',-13,6))
  assert.deepEqual(dungeon3Rules.water.southFoot[1],at('Floor',-10,7))
  assert.deepEqual(dungeon3Rules.water.southFoot[2],at('Floor',5,6))
  assert.deepEqual(dungeon3Rules.water.innerNE,at('Floor',-13,8))
  assert.deepEqual(dungeon3Rules.water.innerNW,at('Floor',5,8))
  assert.equal(at('Floor',-12,7),null)
  assert.ok(at('Floor',-14,7))
  assert.equal(at('Floor',4,7),null)
  assert.ok(at('Floor',6,7))
  for (const motif of Object.values(dungeon3Rules.water.concaveSouth)) {
    assert.equal(motif.height,3)
    for (const {x,y,...tile} of motif.cells) assert.deepEqual(tile,at(motif.source.layer,motif.source.x+x,motif.source.y+y))
  }
  // Diagonal water is east for SE and west for SW at the bottom of the authored transition.
  assert.equal(at('Floor',4,7),null)
  assert.ok(at('Floor',2,7))
  assert.equal(at('Floor2',9,21),null)
  assert.ok(at('Floor2',11,21))
})
