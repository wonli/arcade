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

test('water bodies and bridges use authored visual variants instead of one fixed tile', () => {
  const waterBodies = new Set()
  const bridgeVariants = new Set()
  for (let seed = 1; seed <= 24; seed++) {
    const geometry = generateDungeonGeometry({ runSeed: seed, floor: seed % 5 + 1 })
    for (const tile of renderer.buildDungeon3TilePlan(geometry)) {
      if (tile.layer === 'water-sheen') waterBodies.add(tile.tileId)
    }
    for (const bridge of geometry.bridges) bridgeVariants.add(bridge.variant)
  }
  assert.ok(waterBodies.size >= 2, `expected varied water bodies, saw ${[...waterBodies]}`)
  assert.ok(bridgeVariants.size >= 2, `expected varied bridge variants, saw ${[...bridgeVariants]}`)
})

test('opened doors stamp an authored open frame into the terrain plan', () => {
  const geometry = generateDungeonGeometry({ runSeed: 7 })
  const door = geometry.doors[0]
  const closed = renderer.buildDungeon3TilePlan(geometry).filter(tile => tile.featureKind === 'door' && tile.wallId === door.wallId)
  door.opened = true
  const opened = renderer.buildDungeon3TilePlan(geometry).filter(tile => tile.featureKind === 'door' && tile.wallId === door.wallId)
  assert.ok(closed.length > 0)
  assert.equal(opened.length, closed.length)
  assert.ok(opened.every(tile => tile.doorState === 'open'))
  assert.notDeepEqual(opened.map(tile => tile.tileId), closed.map(tile => tile.tileId))
})

test('side doors rotate the complete authored footprint without changing occupancy', () => {
  const size = 16
  const geometry = {
    seed: 1,
    grid: { tileSize: size, columns: 8, rows: 8, cells: Array.from({ length: 64 }, () => ({ kind: 'floor', level: 0 })) },
    rooms: [], paths: [], bridges: [], stairs: [], walls: [], decorations: [],
    doors: [{ id: 'door-side', pathId: 2, wallId: 'wall-side', x: 56, y: 48, side: 'east', orientation: 'left', opened: false,
      motif: dungeon3Rules.assemblies.door, openMotif: dungeon3Rules.assemblies.doorOpen }],
    waterFeatures: [], elevations: [], traps: [], pavingAreas: [], solids: [],
  }
  const tiles = renderer.buildDungeon3TilePlan(geometry).filter(tile => tile.featureKind === 'door')
  assert.equal(tiles.length, 6)
  assert.equal(new Set(tiles.map(tile => `${tile.x},${tile.y}`)).size, 6)
  assert.deepEqual([...new Set(tiles.map(tile => tile.x))].sort((a, b) => a - b), [32, 48, 64])
  assert.deepEqual([...new Set(tiles.map(tile => tile.y))].sort((a, b) => a - b), [32, 48])
  assert.ok(tiles.every(tile => tile.rotation === -90))
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
    events: {
      on(name, handler) { if (name === 'update') update = handler },
      off() {},
    },
  }

  renderer.renderDungeon3Terrain(scene, geometry)

  assert.equal(imageCalls, 0)
  assert.ok(tiles.length > 1000)
  assert.ok(renderTextures.length <= groups.length)
  assert.ok(renderTextures.length <= 24)
  assert.ok(tracked.length <= 25)
  assert.ok(renderTextures.every(target => target.renders >= 1))

  if (update) {
    update(150)
    assert.ok(renderTextures.some(target => target.clears > 0))
  }
})
