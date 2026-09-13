import test from 'node:test'
import assert from 'node:assert/strict'
import { generateDungeonGeometry } from './map-generator.js'
import { buildNavGrid } from './pathfinding.js'
import { circleHitsSolid } from './spatial.js'

const TILE = 16
const RADIUS = 18
const key = (x,y) => `${x},${y}`

function reachableCells(grid, start) {
  const sx = Math.floor(start.x / grid.cellSize), sy = Math.floor(start.y / grid.cellSize)
  const first = grid.cells.get(key(sx,sy))
  if (!first || first.blocked) return new Set()
  const seen = new Set([key(sx,sy)]), queue = [first]
  for (const current of queue) {
    for (const [dx,dy] of [[1,0],[-1,0],[0,1],[0,-1]]) {
      const nk = key(current.cellX+dx,current.cellY+dy)
      const neighbor = grid.cells.get(nk)
      if (!neighbor || neighbor.blocked || seen.has(nk)) continue
      let blocked = false
      const steps = Math.ceil(grid.cellSize / 4)
      for (let i=1;i<steps;i++) {
        const p={x:current.x+(neighbor.x-current.x)*i/steps,y:current.y+(neighbor.y-current.y)*i/steps}
        if (circleHitsSolid(p,grid.actorRadius,grid.collisionGeometry)) { blocked=true; break }
      }
      if (blocked) continue
      seen.add(nk); queue.push(neighbor)
    }
  }
  return seen
}

test('every physically walkable shrine floor cell remains reachable from the room center', () => {
  for (let seed = 1; seed <= 400; seed++) {
    for (let floor = 1; floor <= 3; floor++) {
      const g = generateDungeonGeometry({ runSeed: seed, floor })
      const room = g.rooms.find(r => r.theme === 'shrine')
      const statue = g.decorations.find(d => d.roomId === room.id && d.kind === 'statue')
      assert.ok(statue, `seed ${seed}/${floor}: missing statue`)
      const nav = buildNavGrid(g, { cellSize: TILE, actorRadius: RADIUS })
      const reachable = reachableCells(nav, room.center)

      for (let y = room.y + TILE / 2; y < room.y + room.height; y += TILE) {
        for (let x = room.x + TILE / 2; x < room.x + room.width; x += TILE) {
          const cell = g.grid.cells[Math.floor(y / TILE) * g.grid.columns + Math.floor(x / TILE)]
          if (!cell || !['floor', 'bridge'].includes(cell.kind)) continue
          const point = { x, y }
          if (circleHitsSolid(point, RADIUS, g)) continue
          assert.ok(
            reachable.has(key(Math.floor(x/TILE),Math.floor(y/TILE))),
            `seed ${seed}/${floor}: walkable shrine floor is isolated at ${x},${y}`,
          )
        }
      }
    }
  }
})
