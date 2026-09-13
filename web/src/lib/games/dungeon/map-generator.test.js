import test from 'node:test'
import assert from 'node:assert/strict'
import { generateDungeonGeometry } from './map-generator.js'
import { buildNavGrid, findPath } from './pathfinding.js'
import { circleHitsSolid } from './spatial.js'

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

test('perimeter walls frame the dungeon and props are denser with oversized authored motifs', () => {
  const scales = new Set()
  let decoratedRooms = 0, totalRooms = 0, totalDecorations = 0
  for (let seed = 1; seed <= 40; seed++) {
    const g = generateDungeonGeometry({ runSeed: seed, floor: 3 })
    totalRooms += g.rooms.length
    const wall = g.decorations.find(d => d.kind === 'wall')
    assert.ok(wall, `seed ${seed}: missing perimeter wall`)
    assert.equal(wall.motif.id, 'perimeter-wall')
    assert.equal(wall.footprint.width, g.bounds.width)
    assert.equal(wall.footprint.height, g.bounds.height)
    const props = g.decorations.filter(d => d.kind !== 'wall')
    totalDecorations += props.length
    for (const d of props) if (d.footprint) scales.add(`${d.footprint.width}x${d.footprint.height}`)
    decoratedRooms += g.rooms.filter(room => props.some(d => d.x >= room.x && d.x <= room.x + room.width && d.y >= room.y && d.y <= room.y + room.height)).length
  }
  assert.ok(totalDecorations / totalRooms >= 3.25, `expected denser dressing, got ${(totalDecorations / totalRooms).toFixed(2)} props/room`)
  assert.ok(decoratedRooms / totalRooms >= 0.8, 'most rooms should receive decoration')
  assert.ok(scales.size >= 5, `expected varied decoration footprints, saw ${[...scales]}`)
  assert.ok([...scales].some(size => size.split('x').map(Number).some(value => value >= 80)), `expected oversized native props, saw ${[...scales]}`)
})

test('room connections keep a generous walkable throat and expose doors and landmarks', () => {
  for (let seed = 1; seed <= 40; seed++) {
    const g = generateDungeonGeometry({ runSeed: seed, floor: 3 })
    assert.ok(g.bridges.every(bridge => (bridge.orientation === 'horizontal' ? bridge.height : bridge.width) >= 96), `seed ${seed}: narrow bridge throat`)
    assert.ok(g.doors.length >= g.paths.length * 2, `seed ${seed}: each connection should have two door frames`)
    assert.ok(g.decorations.some(entry => entry.kind === 'statue'), `seed ${seed}: missing statue landmark`)
    for (const door of g.doors) assert.equal(circleHitsSolid(door, 18, g), false, `seed ${seed}: door blocks its own passage`)
  }
})

test('regression: geometry stays deterministic, tile-aligned, multi-level and collision-safe', () => {
  assert.deepEqual(generateDungeonGeometry({ runSeed: 12, floor: 3 }), generateDungeonGeometry({ runSeed: 12, floor: 3 }))
  assert.notDeepEqual(generateDungeonGeometry({ runSeed: 12 }), generateDungeonGeometry({ runSeed: 13 }))
  for (let seed = 1; seed <= 80; seed++) {
    const g = generateDungeonGeometry({ runSeed: seed, floor: seed % 12 + 1 })
    assert.ok(new Set(g.rooms.map(r => r.level)).size >= 3, `seed ${seed}: missing floor levels`)
    assert.ok(g.paths.length >= g.rooms.length - 1, `seed ${seed}: too few graph edges`)
    assert.ok(g.bridges.length > 0 && g.water.length > 0, `seed ${seed}: missing water/bridges`)
    for (const r of [...g.rooms, ...g.paths, ...g.water]) for (const key of ['x', 'y', 'width', 'height']) assert.equal(r[key] % 16, 0, `seed ${seed}: ${key} off grid`)
    const nav = buildNavGrid(g, { cellSize: 16, actorRadius: 20 })
    const anchors = [g.spawn, g.exit, g.rest, ...g.spawnPoints, ...g.chests]
    for (const anchor of anchors) {
      assert.equal(circleHitsSolid(anchor, 20, g), false, `seed ${seed}: blocked anchor`)
      assert.ok(findPath(nav, g.spawn, anchor).length, `seed ${seed}: unreachable anchor`)
    }
  }
})
