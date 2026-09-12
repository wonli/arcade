import test from 'node:test'
import assert from 'node:assert/strict'
import { generateDungeonGeometry } from './map-generator.js'
import { buildNavGrid, findPath } from './pathfinding.js'
import { circleHitsSolid, movementWithCollision } from './spatial.js'

const route = (g, a, b) => findPath(buildNavGrid(g, { cellSize: 16, actorRadius: 20 }), a, b)

test('same run seed and floor produce stable geometry, different seeds vary layout', () => {
  assert.deepEqual(generateDungeonGeometry({ runSeed: 12, floor: 3 }), generateDungeonGeometry({ runSeed: 12, floor: 3 }))
  assert.notDeepEqual(generateDungeonGeometry({ runSeed: 12 }), generateDungeonGeometry({ runSeed: 13 }))
})

test('maps contain connected rooms at several floor levels and tile-aligned paths', () => {
  const g = generateDungeonGeometry({ runSeed: 77, floor: 2 })
  assert.ok(g.rooms?.length >= 5)
  assert.ok(new Set(g.rooms.map(r => r.level)).size >= 3)
  assert.ok(g.paths?.length >= g.rooms.length - 1)
  assert.ok(g.bridges.length > 0)
  assert.ok(g.water.length > 0)
  for (const r of [...g.rooms, ...g.paths, ...g.water]) {
    for (const key of ['x', 'y', 'width', 'height']) assert.equal(r[key] % 16, 0, `${key} off grid`)
  }
})

test('all runtime anchors and the complete route respect actor collision across seeds', () => {
  const seen = new Set()
  for (let seed = 1; seed <= 80; seed++) {
    const g = generateDungeonGeometry({ runSeed: seed, floor: seed % 12 + 1 })
    seen.add(`${g.spawn.x},${g.spawn.y}`)
    const anchors = [g.spawn, g.exit, g.rest, ...g.spawnPoints, ...g.chests]
    for (const p of anchors) {
      assert.ok(p, `seed ${seed}: missing anchor`)
      assert.equal(circleHitsSolid(p, 20, g), false, `seed ${seed}: blocked anchor`)
      const path = route(g, g.spawn, p)
      assert.ok(path.length, `seed ${seed}: unreachable anchor`)
      const points = [g.spawn, ...path, p]
      for (let i = 1; i < points.length; i++) {
        const a = points[i - 1], b = points[i]
        const moved = movementWithCollision(a, { x: b.x - a.x, y: b.y - a.y }, 20, g)
        assert.ok(Math.hypot(moved.x - b.x, moved.y - b.y) < 0.01, `seed ${seed}: path crosses collision`)
      }
    }
  }
  assert.ok(seen.size > 24)
})

test('coffins and objects have tile footprints and do not obstruct reserved paths', () => {
  const g = generateDungeonGeometry({ runSeed: 33 })
  assert.ok(g.decorations.some(d => d.kind === 'coffin'))
  assert.ok(g.decorations.some(d => d.kind === 'object'))
  for (const d of g.decorations) {
    assert.ok(d.footprint?.width >= 16 && d.footprint?.height >= 16)
    assert.ok(d.motif)
  }
  assert.ok(route(g, g.spawn, g.exit).length)
})
