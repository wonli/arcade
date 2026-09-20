import test from 'node:test'
import assert from 'node:assert/strict'
import { generateDungeonGeometry } from './map-generator.js'
import { buildNavGrid, findPath } from './pathfinding.js'
import { circleHitsSolid, movementWithCollision } from './spatial.js'

function graphDistances(g, start) {
  const adjacency = Array.from({ length: g.rooms.length }, () => [])
  for (const path of g.paths) { adjacency[path.from].push(path.to); adjacency[path.to].push(path.from) }
  const distances = Array(g.rooms.length).fill(Infinity), queue = [start]
  distances[start] = 0
  for (const room of queue) for (const next of adjacency[room]) if (!Number.isFinite(distances[next])) { distances[next] = distances[room] + 1; queue.push(next) }
  return distances
}
function roomForAnchor(g, anchor) {
  return g.rooms.findIndex(r => anchor.x >= r.x && anchor.x <= r.x + r.width && anchor.y >= r.y && anchor.y <= r.y + r.height)
}
function openAllDoors(g) {
  for (const door of g.doors) door.opened = true
  g.solids = g.solids.filter(solid => solid.kind !== 'door')
  return g
}

test('room count varies by seed while staying within the supported range', () => {
  const counts = new Set()
  for (let seed = 1; seed <= 80; seed++) {
    const count = generateDungeonGeometry({ runSeed: seed }).rooms.length
    assert.ok(count >= 4 && count <= 9, `seed ${seed}: ${count} rooms`)
    counts.add(count)
  }
  assert.ok(counts.size >= 4, `expected varied room counts, saw ${[...counts]}`)
  assert.ok([...counts].some(count => count !== 6), 'room count is still fixed at six')
})

test('room levels vary independently of fixed slot rows while respecting edge steps', () => {
  let nonRowAssignments = 0
  for (let seed = 1; seed <= 80; seed++) {
    for (let floor = 1; floor <= 5; floor++) {
      const g = generateDungeonGeometry({ runSeed: seed, floor })
      const levels = new Set(g.rooms.map(room => room.level))
      assert.ok([...levels].every(level => [0, 1, 2].includes(level)), `seed ${seed}, floor ${floor}: invalid level set ${[...levels]}`)
      assert.ok(levels.size >= 2, `seed ${seed}, floor ${floor}: map collapsed to one level`)
      for (const path of g.paths) {
        const a = g.rooms[path.from], b = g.rooms[path.to]
        assert.ok(Math.abs(a.level - b.level) <= 1, `seed ${seed}, floor ${floor}, path ${path.id}: level jump ${a.level}->${b.level}`)
      }
      if (g.rooms.some(room => room.level !== 2 - room.slot.row)) nonRowAssignments++
    }
  }
  assert.ok(nonRowAssignments >= 80, `levels still follow fixed slot rows in ${nonRowAssignments} samples`)
})

test('room graph stays connected and exit is chosen from the farthest graph layer', () => {
  for (let seed = 1; seed <= 40; seed++) {
    const g = generateDungeonGeometry({ runSeed: seed, floor: 2 })
    const start = roomForAnchor(g, g.spawn), finish = roomForAnchor(g, g.exit)
    assert.ok(start >= 0 && finish >= 0, `seed ${seed}: anchors must belong to rooms`)
    const distances = graphDistances(g, start)
    assert.ok(distances.every(Number.isFinite), `seed ${seed}: disconnected room graph`)
    assert.equal(distances[finish], Math.max(...distances), `seed ${seed}: exit is not graph-distant`)
  }
})

test('authored walls frame the rooms and props are denser with complete multi-tile motifs', () => {
  const scales = new Set()
  let decoratedRooms = 0, totalRooms = 0, totalDecorations = 0
  for (let seed = 1; seed <= 40; seed++) {
    const g = generateDungeonGeometry({ runSeed: seed, floor: 3 })
    totalRooms += g.rooms.length
    assert.equal(g.walls.length, g.rooms.length * 4)
    assert.ok(g.walls.every(w => w.roomId != null && ['horizontal', 'vertical'].includes(w.orientation)))
    const props = g.decorations.filter(d => d.kind !== 'wall')
    totalDecorations += props.length
    for (const d of props) if (d.footprint) scales.add(`${d.footprint.width}x${d.footprint.height}`)
    decoratedRooms += g.rooms.filter(room => props.some(d => d.x >= room.x && d.x <= room.x + room.width && d.y >= room.y && d.y <= room.y + room.height)).length
  }
  assert.ok(totalDecorations / totalRooms >= 3.25, `expected denser dressing, got ${(totalDecorations / totalRooms).toFixed(2)} props/room`)
  assert.ok(decoratedRooms / totalRooms >= 0.8, 'most rooms should receive decoration')
  assert.ok(scales.size >= 5, `expected varied decoration footprints, saw ${[...scales]}`)
  assert.ok([...scales].some(size => size.split('x').map(Number).some(value => value >= 64)), `expected complete multi-tile props, saw ${[...scales]}`)
})

test('generated rooms spend more of the authored terrain vocabulary', () => {
  const kinds = new Set()
  for (let seed = 1; seed <= 50; seed++) {
    const geometry = generateDungeonGeometry({ runSeed: seed, floor: seed % 6 + 1 })
    for (const decoration of geometry.decorations) {
      kinds.add(decoration.kind)
      assert.equal(decoration.motif?.cells?.some(cell => cell.tileset === 'Arches_columns'), false,
        `seed ${seed}: bridge arch resource leaked into ordinary decoration`)
    }
  }
  assert.ok(kinds.has('candle'), `missing candles from generated terrain: ${[...kinds]}`)
  assert.ok(kinds.has('relief'), `missing reliefs from generated terrain: ${[...kinds]}`)
})

test('keys are not emitted as ordinary random floor decorations', () => {
  const keyTiles = new Set([237, 238])
  for (let seed = 1; seed <= 80; seed++) {
    const g = generateDungeonGeometry({ runSeed: seed, floor: seed % 6 + 1 })
    for (const decoration of g.decorations.filter(entry => entry.kind === 'object')) {
      assert.equal(decoration.motif.cells.some(cell => keyTiles.has(cell.tileId)), false,
        `seed ${seed}: key motif ${decoration.motif.id} was placed as generic decoration`)
    }
  }
})

test('room connections keep a generous walkable throat and expose doors without rest-room statues', () => {
  for (let seed = 1; seed <= 40; seed++) {
    const g = generateDungeonGeometry({ runSeed: seed, floor: 3 })
    assert.ok(g.bridges.every(bridge => (bridge.orientation === 'horizontal' ? bridge.height : bridge.width) >= 64), `seed ${seed}: narrow bridge throat`)
    assert.ok(g.doors.every(d => g.walls.some(w => w.id === d.wallId)), `seed ${seed}: doors must belong to walls`)
    assert.equal(g.decorations.some(entry => entry.kind === 'statue'), false, `seed ${seed}: rest-room statue leaked into ordinary geometry`)
    for (const door of g.doors) {
      assert.equal(door.role, 'gate')
      assert.equal(door.opened, false)
      assert.ok(door.collision)
      assert.ok(g.solids.some(solid => solid.doorId === door.id))
    }
  }
})

test('water bridges use a narrower crossing throat than ordinary corridors', () => {
  for (let seed = 1; seed <= 40; seed++) {
    for (let floor = 1; floor <= 4; floor++) {
      const g = generateDungeonGeometry({ runSeed: seed, floor })
      for (const bridge of g.bridges) {
        const throat = bridge.orientation === 'horizontal' ? bridge.height : bridge.width
        assert.equal(throat, 80, `seed ${seed}, floor ${floor}, path ${bridge.pathId}: bridge throat should be 80px`)
        assert.ok(throat < 96, `seed ${seed}, floor ${floor}, path ${bridge.pathId}: bridge inherited the corridor width`)
        const walkableThroat = bridge.orientation === 'horizontal' ? bridge.walkable.height : bridge.walkable.width
        assert.equal(walkableThroat, 96, `seed ${seed}, floor ${floor}, path ${bridge.pathId}: actor clearance changed`)
        for (const key of ['x', 'y', 'width', 'height']) assert.equal(bridge[key] % 16, 0,
          `seed ${seed}, floor ${floor}, path ${bridge.pathId}: bridge ${key} is off tile grid`)
      }
    }
  }
})

test('doors only occupy walls that have a real same-level connection', () => {
  for (let seed = 1; seed <= 40; seed++) {
    const g = generateDungeonGeometry({ runSeed: seed })
    for (const door of g.doors) {
      const wall = g.walls.find(entry => entry.id === door.wallId)
      const path = g.paths.find(entry => entry.id === door.pathId)
      assert.ok(wall?.opening && path, `seed ${seed}: door must belong to a path opening`)
      assert.equal(path.connectionKind, 'door', `seed ${seed}: door ${door.id} is not a door connection`)
      assert.equal(path.levelDelta, 0, `seed ${seed}: door ${door.id} changes level`)
      assert.equal(path.crossesWater, false, `seed ${seed}: door ${door.id} is over water`)
    }
  }
})

test('stair connections keep a wall opening but never place a door on the stairs', () => {
  for (let seed = 1; seed <= 40; seed++) {
    for (let floor = 1; floor <= 4; floor++) {
      const g = generateDungeonGeometry({ runSeed: seed, floor })
      for (const stair of g.stairs) {
        const path = g.paths.find(entry => entry.id === stair.pathId)
        assert.equal(path?.connectionKind, 'stairs', `seed ${seed}, floor ${floor}: stair has wrong path kind`)
        assert.equal(g.doors.some(door => door.pathId === stair.pathId), false,
          `seed ${seed}, floor ${floor}: door overlaps stair path ${stair.pathId}`)
      }
      for (const door of g.doors) {
        const path = g.paths.find(entry => entry.id === door.pathId)
        assert.ok(path, `seed ${seed}, floor ${floor}: door has no path`)
        assert.equal(path.connectionKind, 'door', `seed ${seed}, floor ${floor}: door placed on ${path.connectionKind} path`)
      }
    }
  }
})

test('regression: geometry stays deterministic, tile-aligned, multi-level and collision-safe', () => {
  assert.deepEqual(generateDungeonGeometry({ runSeed: 12, floor: 3 }), generateDungeonGeometry({ runSeed: 12, floor: 3 }))
  assert.notDeepEqual(generateDungeonGeometry({ runSeed: 12 }), generateDungeonGeometry({ runSeed: 13 }))
  let mapsWithBridges = 0
  for (let seed = 1; seed <= 80; seed++) {
    const g = generateDungeonGeometry({ runSeed: seed, floor: seed % 12 + 1 })
    assert.ok(new Set(g.rooms.map(r => r.level)).size >= 2, `seed ${seed}: missing floor levels`)
    assert.ok(g.paths.length >= g.rooms.length - 1, `seed ${seed}: too few graph edges`)
    assert.ok(g.water.length > 0, `seed ${seed}: missing water`)
    if (g.bridges.length) mapsWithBridges++
    for (const r of [...g.rooms, ...g.paths, ...g.water]) for (const key of ['x', 'y', 'width', 'height']) assert.equal(r[key] % 16, 0, `seed ${seed}: ${key} off grid`)
    const nav = buildNavGrid(openAllDoors(g), { cellSize: 16, actorRadius: 20 })
    const anchors = [g.spawn, g.exit, g.rest, ...g.spawnPoints, ...g.chests]
    for (const anchor of anchors) {
      assert.equal(circleHitsSolid(anchor, 20, g), false, `seed ${seed}: blocked anchor`)
      assert.ok(findPath(nav, g.spawn, anchor).length, `seed ${seed}: unreachable anchor`)
    }
  }
  assert.ok(mapsWithBridges > 0, 'bridge connection never generated across samples')
})


test('the actual movement solver traverses terrace stairs and bridges for players and bosses', () => {
  for (let seed = 1; seed <= 40; seed++) {
    const g = generateDungeonGeometry({runSeed:seed})
    openAllDoors(g)
    for (const radius of [20,26]) {
      const nav = buildNavGrid(g,{cellSize:16,actorRadius:radius})
      const path = findPath(nav,g.spawn,g.exit)
      assert.ok(path.length, `seed ${seed}, radius ${radius}: missing route`)
      let p = g.spawn
      for (const target of [...path,g.exit]) {
        p = movementWithCollision(p,{x:target.x-p.x,y:target.y-p.y},radius,g)
        assert.ok(Math.hypot(p.x-target.x,p.y-target.y)<0.1, `seed ${seed}, radius ${radius}: movement diverges from navigation`)
      }
    }
  }
})
