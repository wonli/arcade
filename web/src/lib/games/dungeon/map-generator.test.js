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

test('authored walls frame the rooms and props are denser with complete multi-tile motifs', () => {
  const scales = new Set()
  let decoratedRooms = 0, totalRooms = 0, totalDecorations = 0
  for (let seed = 1; seed <= 40; seed++) {
    const g = generateDungeonGeometry({ runSeed: seed, floor: 3 })
    totalRooms += g.rooms.length
    assert.equal(g.walls.length, g.rooms.length)
    assert.ok(g.walls.every(w => w.height === 48 && w.roomId != null))
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

test('room connections keep a generous walkable throat and expose doors and landmarks', () => {
  for (let seed = 1; seed <= 40; seed++) {
    const g = generateDungeonGeometry({ runSeed: seed, floor: 3 })
    assert.ok(g.bridges.every(bridge => (bridge.orientation === 'horizontal' ? bridge.height : bridge.width) >= 64), `seed ${seed}: narrow bridge throat`)
    assert.ok(g.doors.length > 0 && g.doors.every(d => g.walls.some(w => w.id === d.wallId)), `seed ${seed}: doors must belong to walls`)
    assert.ok(g.decorations.some(entry => entry.kind === 'statue'), `seed ${seed}: missing statue landmark`)
    for (const door of g.doors) assert.equal(door.role, 'alcove', `seed ${seed}: closed doors must not seal bridge connections`)
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


test('the actual movement solver traverses terrace stairs and bridges for players and bosses', () => {
  for (let seed = 1; seed <= 40; seed++) {
    const g = generateDungeonGeometry({runSeed:seed})
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
