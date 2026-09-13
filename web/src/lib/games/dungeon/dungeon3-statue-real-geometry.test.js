import test from 'node:test'
import assert from 'node:assert/strict'
import { generateDungeonGeometry } from './map-generator.js'
import { buildNavGrid, findPath } from './pathfinding.js'
import { circleHitsSolid } from './spatial.js'

const TILE = 16
const RADIUS = 18

test('every physically walkable shrine floor cell remains reachable from the room center', () => {
  for (let seed = 1; seed <= 400; seed++) {
    for (let floor = 1; floor <= 3; floor++) {
      const g = generateDungeonGeometry({ runSeed: seed, floor })
      const room = g.rooms.find(r => r.theme === 'shrine')
      const statue = g.decorations.find(d => d.roomId === room.id && d.kind === 'statue')
      assert.ok(statue, `seed ${seed}/${floor}: missing statue`)
      const nav = buildNavGrid(g, { cellSize: TILE, actorRadius: RADIUS })

      for (let y = room.y + TILE / 2; y < room.y + room.height; y += TILE) {
        for (let x = room.x + TILE / 2; x < room.x + room.width; x += TILE) {
          const cell = g.grid.cells[Math.floor(y / TILE) * g.grid.columns + Math.floor(x / TILE)]
          if (!cell || !['floor', 'bridge'].includes(cell.kind)) continue
          const point = { x, y }
          if (circleHitsSolid(point, RADIUS, g)) continue
          assert.ok(
            findPath(nav, room.center, point).length,
            `seed ${seed}/${floor}: walkable shrine floor is isolated at ${x},${y}`,
          )
        }
      }
    }
  }
})
