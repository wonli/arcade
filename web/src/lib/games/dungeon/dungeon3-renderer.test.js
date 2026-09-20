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

test('boundary cells remain visible water instead of becoming a blank map edge', () => {
  const geometry = {
    seed: 1,
    grid: { tileSize: 16, columns: 3, rows: 2, cells: [
      { kind: 'boundary', level: 0 }, { kind: 'water', level: 0 }, { kind: 'boundary', level: 0 },
      { kind: 'boundary', level: 0 }, { kind: 'floor', level: 0 }, { kind: 'boundary', level: 0 },
    ] },
    rooms: [], paths: [], bridges: [], stairs: [], doors: [], walls: [], decorations: [],
    waterFeatures: [], elevations: [], traps: [], pavingAreas: [], solids: [],
  }
  const tiles = renderer.buildDungeon3TilePlan(geometry)
  assert.equal(tiles.filter(tile => tile.layer === 'water-edge').length, 4)
  assert.equal(tiles.filter(tile => tile.layer === 'water-edge').every(tile => tile.tileset === 'Water_coasts_animation'), true)
})

test('vertical wall rendering keeps both sides of a door opening filled', () => {
  const geometry = {
    seed: 1,
    grid: { tileSize: 16, columns: 8, rows: 8, cells: Array.from({ length: 64 }, () => ({ kind: 'floor', level: 0 })) },
    rooms: [], paths: [], bridges: [], stairs: [], doors: [], decorations: [], waterFeatures: [], elevations: [], traps: [], pavingAreas: [], solids: [],
    walls: [{ id: 'wall-east', side: 'east', orientation: 'vertical', x: 64, y: 16, width: 48, height: 80,
      opening: { y: 40, height: 32, pathId: 3 }, }],
  }
  const tiles = renderer.buildDungeon3TilePlan(geometry).filter(tile => tile.layer === 'wall')
  assert.ok(tiles.length > 0)
  assert.ok(tiles.some(tile => tile.y < 40))
  assert.ok(tiles.some(tile => tile.y >= 72))
  assert.equal(tiles.some(tile => tile.y >= 40 && tile.y < 72), false)
})

test('east and west walls use their authored facing edge strips', () => {
  const geometry = {
    seed: 1,
    grid: { tileSize: 16, columns: 10, rows: 8, cells: Array.from({ length: 80 }, () => ({ kind: 'floor', level: 0 })) },
    rooms: [], paths: [], bridges: [], stairs: [], doors: [], decorations: [], waterFeatures: [], elevations: [], traps: [], pavingAreas: [], solids: [],
    walls: [
      { id: 'wall-west', side: 'west', orientation: 'vertical', x: 32, y: 16, width: 16, height: 96, opening: null },
      { id: 'wall-east', side: 'east', orientation: 'vertical', x: 112, y: 16, width: 16, height: 96, opening: null },
    ],
  }
  const tiles = renderer.buildDungeon3TilePlan(geometry).filter(tile => tile.layer === 'wall')
  assert.equal(tiles.find(tile => tile.wallId === 'wall-west').tileId, dungeon3Rules.assemblies.wallVerticalWest.cells[0].tileId)
  assert.equal(tiles.find(tile => tile.wallId === 'wall-east').tileId, dungeon3Rules.assemblies.wallVerticalEast.cells[0].tileId)
})

test('vertical room edges use the authored west and east wall strips', () => {
  const geometry = {
    seed: 1,
    grid: { tileSize: 16, columns: 10, rows: 8, cells: Array.from({ length: 80 }, () => ({ kind: 'floor', level: 0 })) },
    rooms: [], paths: [], bridges: [], stairs: [], doors: [], decorations: [], waterFeatures: [], elevations: [], traps: [], pavingAreas: [], solids: [],
    walls: [
      { id: 'wall-west', side: 'west', orientation: 'vertical', x: 32, y: 16, width: 16, height: 96, opening: null },
      { id: 'wall-east', side: 'east', orientation: 'vertical', x: 112, y: 16, width: 16, height: 96, opening: null },
    ],
  }
  const tiles = renderer.buildDungeon3TilePlan(geometry).filter(tile => tile.layer === 'wall')
  const west = tiles.filter(tile => tile.wallId === 'wall-west')
  const east = tiles.filter(tile => tile.wallId === 'wall-east')
  assert.equal(west[0].tileId, dungeon3Rules.assemblies.wallVerticalWest.cells[0].tileId)
  assert.equal(east[0].tileId, dungeon3Rules.assemblies.wallVerticalEast.cells[0].tileId)
  assert.equal(west.some(tile => tile.rotation != null), false)
  assert.equal(east.some(tile => tile.rotation != null), false)
})

test('long vertical room edges keep one authored cap and repeat only the middle wall', () => {
  const geometry = {
    seed: 1,
    grid: { tileSize: 16, columns: 10, rows: 16, cells: Array.from({ length: 160 }, () => ({ kind: 'floor', level: 0 })) },
    rooms: [], paths: [], bridges: [], stairs: [], doors: [], decorations: [], waterFeatures: [], elevations: [], traps: [], pavingAreas: [], solids: [],
    walls: [{ id: 'wall-west', side: 'west', orientation: 'vertical', x: 32, y: 16, width: 16, height: 192, opening: null }],
  }
  const tiles = renderer.buildDungeon3TilePlan(geometry).filter(tile => tile.wallId === 'wall-west')
  const edge = dungeon3Rules.assemblies.wallVerticalWest.cells.map(cell => cell.tileId)
  const body = dungeon3Rules.assemblies.wallVerticalWestBody.cells.map(cell => cell.tileId)
  assert.equal(tiles.length, 12)
  assert.equal(tiles.filter(tile => tile.tileId === body.at(-1)).length, 1, 'wall foot occurs only at the end')
  assert.deepEqual(tiles.slice(1, -3).map(tile => tile.tileId), Array(8).fill(edge[1]))
  assert.deepEqual(tiles.slice(-3).map(tile => tile.tileId), body)
})

test('touching side walls do not restart their caps or feet at a room boundary', () => {
  const geometry = {
    seed: 1,
    grid: { tileSize: 16, columns: 10, rows: 16, cells: Array.from({ length: 160 }, () => ({ kind: 'floor', level: 0 })) },
    rooms: [], paths: [], walls: [
      { id: 'upper', side: 'east', orientation: 'vertical', x: 32, y: 16, width: 16, height: 96 },
      { id: 'lower', side: 'east', orientation: 'vertical', x: 32, y: 112, width: 16, height: 96 },
    ],
  }
  const tiles = renderer.buildDungeon3TilePlan(geometry).filter(tile => tile.layer === 'wall')
  const edge = dungeon3Rules.assemblies.wallVerticalEast.cells
  const foot = dungeon3Rules.assemblies.wallVerticalEastBody.cells.at(-1).tileId
  assert.equal(tiles.length, 12)
  assert.equal(tiles.filter(tile => tile.tileId === foot).length, 1)
  assert.equal(tiles.find(tile => tile.y === 96).tileId, edge[1].tileId)
  assert.equal(tiles.find(tile => tile.y === 112).tileId, edge[1].tileId)
})

test('horizontal wall sections keep authored left-to-right order at any world x', () => {
  const geometry = {
    seed: 1,
    grid: { tileSize: 16, columns: 12, rows: 8, cells: Array.from({ length: 96 }, () => ({ kind: 'floor', level: 0 })) },
    rooms: [], paths: [], bridges: [], stairs: [], doors: [], decorations: [], waterFeatures: [], elevations: [], traps: [], pavingAreas: [], solids: [],
    walls: [
      { id: 'wall-even', side: 'north', orientation: 'horizontal', x: 32, y: 16, width: 32, height: 48, opening: null },
      { id: 'wall-odd', side: 'north', orientation: 'horizontal', x: 48, y: 80, width: 32, height: 48, opening: null },
    ],
  }
  const tiles = renderer.buildDungeon3TilePlan(geometry).filter(tile => tile.layer === 'wall')
  const expected = dungeon3Rules.assemblies.wall.cells
  assert.deepEqual(tiles.filter(tile => tile.wallId === 'wall-even' && tile.y === 16).map(tile => tile.tileId), [expected[0].tileId, expected[1].tileId])
  assert.deepEqual(tiles.filter(tile => tile.wallId === 'wall-odd' && tile.y === 80).map(tile => tile.tileId), [expected[0].tileId, expected[1].tileId])
})

test('horizontal wall ends close the authored corner against side walls', () => {
  const geometry = {
    seed: 1,
    grid: { tileSize: 16, columns: 12, rows: 10, cells: Array.from({ length: 120 }, () => ({ kind: 'floor', level: 0 })) },
    rooms: [], paths: [], bridges: [], stairs: [], doors: [], decorations: [], waterFeatures: [], elevations: [], traps: [], pavingAreas: [], solids: [],
    walls: [{ id: 'wall-north', side: 'north', orientation: 'horizontal', x: 32, y: 16, width: 64, height: 48, opening: null }],
  }
  const tiles = renderer.buildDungeon3TilePlan(geometry).filter(tile => tile.layer === 'wall-cap' && tile.wallId === 'wall-north')
  const cap = dungeon3Rules.assemblies.wallCap09.cells.map(cell => cell.tileId)
  assert.deepEqual(tiles.filter(tile => tile.x === 16).map(tile => tile.tileId), cap)
  assert.deepEqual(tiles.filter(tile => tile.x === 96).map(tile => tile.tileId), cap)
})

test('wall footprints cover water underneath instead of leaking through transparent edges', () => {
  const size = 16
  const cells = Array.from({ length: 100 }, () => ({ kind: 'floor', level: 0 }))
  for (const x of [1, 2, 3, 4, 5, 6]) cells[x + 1 * 10] = { kind: 'water', level: 0 }
  for (const y of [2, 3, 4]) cells[y * 10 + 1] = { kind: 'water', level: 0 }
  const geometry = {
    seed: 1,
    grid: { tileSize: size, columns: 10, rows: 10, cells },
    rooms: [], paths: [], bridges: [], stairs: [], doors: [], decorations: [], waterFeatures: [], elevations: [], traps: [], pavingAreas: [], solids: [],
    walls: [
      { id: 'wall-north', side: 'north', orientation: 'horizontal', x: 16, y: 16, width: 96, height: 48, opening: null },
      { id: 'wall-west', side: 'west', orientation: 'vertical', x: 16, y: 32, width: 16, height: 48, opening: null },
    ],
  }
  const tiles = renderer.buildDungeon3TilePlan(geometry).filter(tile => tile.layer === 'wall-underlay')
  assert.ok(tiles.some(tile => tile.x === 16 && tile.y === 16))
  assert.ok(tiles.some(tile => tile.x === 16 && tile.y === 32))
  assert.ok(tiles.some(tile => tile.x === 16 && tile.y === 48))
  assert.ok(tiles.some(tile => tile.x === 16 && tile.y === 64))
})

test('a connected room pair renders one wall band for the path instead of two parallel walls', () => {
  const geometry = {
    seed: 1,
    grid: { tileSize: 16, columns: 12, rows: 12, cells: Array.from({ length: 144 }, () => ({ kind: 'floor', level: 0 })) },
    rooms: [{ center: { x: 96, y: 64 } }, { center: { x: 96, y: 128 } }],
    paths: [{ id: 7, from: 0, to: 1, direction: { axis: 'vertical', fromSide: 'south', toSide: 'north' } }],
    bridges: [], stairs: [], doors: [], decorations: [], waterFeatures: [], elevations: [], traps: [], pavingAreas: [], solids: [],
    walls: [
      { id: 'wall-0-south', roomId: 0, side: 'south', orientation: 'horizontal', x: 32, y: 64, width: 128, height: 48, opening: { x: 80, width: 96, pathId: 7 } },
      { id: 'wall-1-north', roomId: 1, side: 'north', orientation: 'horizontal', x: 32, y: 48, width: 128, height: 48, opening: { x: 80, width: 96, pathId: 7 } },
    ],
  }
  const tiles = renderer.buildDungeon3TilePlan(geometry).filter(tile => tile.layer === 'wall')
  assert.ok(tiles.length > 0)
  assert.ok(tiles.every(tile => tile.wallId === 'wall-0-south'))
})

test('non-door horizontal openings use authored wall caps without a second wall layer', () => {
  const size = 16
  const geometry = {
    seed: 1,
    grid: { tileSize: size, columns: 16, rows: 12, cells: Array.from({ length: 192 }, () => ({ kind: 'floor', level: 0 })) },
    rooms: [
      { center: { x: 48, y: 64 } }, { center: { x: 160, y: 64 } },
      { center: { x: 48, y: 160 } }, { center: { x: 160, y: 160 } },
    ],
    paths: [
      { id: 'open', from: 0, to: 1, direction: { fromSide: 'south' }, connectionKind: 'open' },
      { id: 'door', from: 2, to: 3, direction: { fromSide: 'south' }, connectionKind: 'door' },
    ],
    bridges: [], stairs: [], doors: [], decorations: [], waterFeatures: [], elevations: [], traps: [], pavingAreas: [], solids: [],
    walls: [
      { id: 'wall-0-south', orientation: 'horizontal', x: 32, y: 32, width: 176, height: 48,
        opening: { x: 96, width: 32, pathId: 'open' } },
      { id: 'wall-2-south', orientation: 'horizontal', x: 32, y: 128, width: 176, height: 48,
        opening: { x: 96, width: 32, pathId: 'door' } },
    ],
  }
  const tiles = renderer.buildDungeon3TilePlan(geometry)
  const caps = tiles.filter(tile => tile.layer === 'wall-cap' && !tile.wallEnd)

  assert.deepEqual(caps.map(tile => [tile.x, tile.y, tile.tileId]), [
    [80, 32, 209], [80, 48, 229], [80, 64, 249],
    [128, 32, 209], [128, 48, 229], [128, 64, 249],
  ])
  assert.equal(tiles.some(tile => tile.layer === 'wall' && tile.wallId === 'wall-0-south' && [80, 128].includes(tile.x)), false)
  assert.equal(tiles.some(tile => tile.layer === 'wall-cap' && !tile.wallEnd && tile.wallId === 'wall-2-south'), false)
})

test('touching rooms without a connection also share one boundary wall band', () => {
  const geometry = {
    seed: 1,
    grid: { tileSize: 16, columns: 12, rows: 12, cells: Array.from({ length: 144 }, () => ({ kind: 'floor', level: 0 })) },
    rooms: [], paths: [], bridges: [], stairs: [], doors: [], decorations: [], waterFeatures: [], elevations: [], traps: [], pavingAreas: [], solids: [],
    walls: [
      { id: 'wall-lower-north', roomId: 1, side: 'north', orientation: 'horizontal', x: 32, y: 48, width: 128, height: 48, opening: null },
      { id: 'wall-upper-south', roomId: 0, side: 'south', orientation: 'horizontal', x: 32, y: 64, width: 128, height: 48, opening: null },
    ],
  }
  const tiles = renderer.buildDungeon3TilePlan(geometry).filter(tile => tile.layer === 'wall')
  assert.ok(tiles.length > 0)
  assert.ok(tiles.every(tile => tile.wallId === 'wall-upper-south'))
})

test('flat and arch bridges both stamp authored Arches_columns structure in either direction', () => {
  const size = 16
  const cells = Array.from({ length: 20 * 12 }, () => ({ kind: 'water', level: 0 }))
  const markBridge = (x, y, width, height) => {
    for (let yy = y / size; yy < (y + height) / size; yy++) for (let xx = x / size; xx < (x + width) / size; xx++) cells[yy * 20 + xx] = { kind: 'bridge', level: 0 }
  }
  markBridge(96, 48, 96, 80)
  markBridge(240, 48, 80, 96)
  const geometry = {
    seed: 1, grid: { tileSize: size, columns: 20, rows: 12, cells },
    rooms: [], paths: [], stairs: [], doors: [], walls: [], decorations: [], waterFeatures: [], elevations: [], traps: [], pavingAreas: [], solids: [],
    bridges: [
      { x: 96, y: 48, width: 96, height: 80, orientation: 'horizontal', structure: 'flat', variant: 0, pathId: 'flat' },
      { x: 240, y: 48, width: 80, height: 96, orientation: 'vertical', structure: 'arch', variant: 1, pathId: 'arch' },
    ],
  }
  const structures = renderer.buildDungeon3TilePlan(geometry).filter(tile => tile.layer === 'bridge-structure')
  assert.ok(structures.some(tile => tile.pathId === 'flat'))
  assert.ok(structures.some(tile => tile.pathId === 'arch'))
  assert.ok(structures.every(tile => tile.tileset === 'Arches_columns'))
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
