import test from 'node:test'
import assert from 'node:assert/strict'
import { generateDungeonGeometry } from './map-generator.js'
import { buildNavGrid, findPath } from './pathfinding.js'
import { circleHitsSolid } from './spatial.js'

const RADIUS = 18

function blockersAt(g, point) {
  const hits = []
  for (const solid of g.solids ?? []) {
    const nearestX = Math.max(solid.x, Math.min(point.x, solid.x + solid.width))
    const nearestY = Math.max(solid.y, Math.min(point.y, solid.y + solid.height))
    const dx = point.x - nearestX, dy = point.y - nearestY
    if (dx * dx + dy * dy < RADIUS * RADIUS) hits.push({ source: 'solid', ...solid })
  }
  for (const water of g.water ?? []) {
    const nearestX = Math.max(water.x, Math.min(point.x, water.x + water.width))
    const nearestY = Math.max(water.y, Math.min(point.y, water.y + water.height))
    const dx = point.x - nearestX, dy = point.y - nearestY
    if (dx * dx + dy * dy < RADIUS * RADIUS) hits.push({ source: 'water', ...water })
  }
  return hits
}

test('generated shrine keeps the visible floor around Statue_fire reachable', () => {
  for (let seed = 1; seed <= 400; seed++) {
    for (let floor = 1; floor <= 3; floor++) {
      const g = generateDungeonGeometry({ runSeed: seed, floor })
      const room = g.rooms.find(r => r.theme === 'shrine')
      const statue = g.decorations.find(d => d.roomId === room.id && d.kind === 'statue')
      assert.ok(statue, `seed ${seed}/${floor}: missing statue`)
      const left = statue.x - statue.footprint.width / 2
      const top = statue.y - statue.footprint.height / 2
      const samples = [
        { name: 'left-flank', x: left + 12, y: top + 96 },
        { name: 'right-flank', x: left + 68, y: top + 96 },
        { name: 'front-left', x: left + 16, y: top + 112 },
        { name: 'front-center', x: left + 40, y: top + 112 },
        { name: 'front-right', x: left + 64, y: top + 112 },
      ]
      const nav = buildNavGrid(g, { cellSize: 16, actorRadius: RADIUS })
      for (const point of samples) {
        assert.equal(circleHitsSolid(point, RADIUS, g), false,
          `seed ${seed}/${floor}: ${point.name} is physically blocked at ${point.x},${point.y}; blockers=${JSON.stringify(blockersAt(g, point))}`)
        assert.ok(findPath(nav, room.center, point).length,
          `seed ${seed}/${floor}: ${point.name} cannot be reached from shrine center at ${point.x},${point.y}`)
      }
    }
  }
})
