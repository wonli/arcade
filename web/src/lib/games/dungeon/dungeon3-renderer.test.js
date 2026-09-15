import test from 'node:test'
import assert from 'node:assert/strict'
import { generateDungeonGeometry } from './map-generator.js'
import * as renderer from './dungeon3-renderer.js'
import { dungeon3Rules } from './dungeon3-rules.js'

test('tile plan places coasts on land, feet over water, and preserves full authored props', () => {
  const g = generateDungeonGeometry({ runSeed: 33 })
  const tiles = renderer.buildDungeon3TilePlan(g)
  const at = (x,y) => g.grid.cells[Math.floor(y/16)*g.grid.columns+Math.floor(x/16)]?.kind
  assert.ok(tiles.some(t=>t.layer==='coast'))
  assert.ok(tiles.some(t=>t.layer==='path' && t.tileset==='plates'))
  assert.ok(tiles.some(t=>t.layer==='floor' && t.tileset==='walls_floor'))
  assert.ok(tiles.some(t=>t.featureKind==='door' && t.tileset==='doors'))
  assert.equal(tiles.some(t=>t.tileset==='Statue_fire'), false, 'Statue_fire is reserved for the dedicated rest room')
  for (const t of tiles) {
    assert.equal(t.x%16,0); assert.equal(t.y%16,0)
    const set = dungeon3Rules.tilesets[t.tileset]
    assert.ok(set && t.tileId >= 0 && t.tileId < set.tileCount)
    if(t.layer==='coast') assert.ok(['floor','bridge'].includes(at(t.x,t.y)))
    if(t.layer==='cliff-foot') assert.equal(at(t.x,t.y),'water')
  }
  for(const prop of g.decorations.filter(prop=>prop.motif)) {
    const rendered=tiles.filter(t=>t.motifId===prop.motif.id && t.ownerX===prop.x && t.ownerY===prop.y)
    assert.equal(rendered.length,prop.motif.cells.length)
    assert.deepEqual(rendered.map(t=>t.tileId),prop.motif.cells.map(t=>t.tileId))
  }
})

test('rectangle shorelines have correct compass corners with no coast on interior cells', () => {
  const cells=Array.from({length:49},(_,i)=>({kind:i%7>=1&&i%7<=5&&Math.floor(i/7)>=1&&Math.floor(i/7)<=5?'floor':'water',level:0}))
  const tiles=renderer.buildDungeon3TilePlan({grid:{tileSize:16,columns:7,rows:7,cells},rooms:[],paths:[],stairs:[],doors:[],decorations:[]})
  const frame=(x,y)=>tiles.find(t=>t.layer==='coast'&&t.x===x*16&&t.y===y*16)?.tileId
  assert.equal(frame(1,1),175); assert.equal(frame(5,1),177)
  assert.equal(frame(1,5),233); assert.equal(frame(5,5),235)
  assert.equal(frame(3,3),undefined)
})

test('floor levels carry authored inset floor panels and southern concave transitions remain whole', () => {
  const g=generateDungeonGeometry({runSeed:33})
  const tiles=renderer.buildDungeon3TilePlan(g)
  assert.ok(tiles.some(t=>t.layer==='floor-panel'&&t.tileset==='walls_floor'))
  for(const t of tiles.filter(t=>t.motifId==='coast-concave-sw'||t.motifId==='coast-concave-se')) {
    assert.ok([150,152,179,181,208,210].includes(t.tileId))
  }
  assert.ok(tiles.some(t=>t.layer==='stairs'&&t.motifId===dungeon3Rules.motifs.stairs.find(m=>m.width===5).id))
})

test('terrain renderer batches tile plan into render textures instead of one game object per tile', () => {
  const geometry = generateDungeonGeometry({ runSeed: 33 })
  const tiles = renderer.buildDungeon3TilePlan(geometry)
  const groups = renderer.groupDungeon3TerrainTiles(tiles)
  const renderTextures = []
  let imageCalls = 0
  let update = null
  const tracked = []

  const scene = {
    textures: { exists() { return true } },
    trackArena(object) { tracked.push(object); return object },
    add: {
      renderTexture() {
        const target = {
          renders: 0,
          clears: 0,
          setOrigin() { return this },
          setDepth(depth) { this.depth = depth; return this },
          stamp() { return this },
          render() { this.renders++; return this },
          clear() { this.clears++; return this },
          destroy() {},
        }
        renderTextures.push(target)
        return target
      },
      image() { imageCalls++; throw new Error('batched terrain must not allocate per-tile images') },
      graphics() {
        return { setDepth() { return this }, fillStyle() { return this }, fillRect() { return this }, destroy() {} }
      },
    },
    events: { on(name, fn) { if (name === 'update') update = fn }, off() {}, once() {} },
    time: { now: 0 },
  }

  renderer.renderDungeon3Terrain(scene, geometry)
  assert.ok(renderTextures.length > 0)
  assert.ok(groups.size > 0)
  assert.equal(imageCalls, 0)
  assert.equal(typeof update, 'function')
  assert.ok(tracked.length <= renderTextures.length + 2)
})
