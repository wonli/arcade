import test from 'node:test'
import assert from 'node:assert/strict'
import { generateDungeonGeometry } from './map-generator.js'
import { buildNavGrid, findPath } from './pathfinding.js'
import { circleHitsSolid } from './spatial.js'

const TILE = 16
const RADIUS = 18

test('generated shrine keeps a practical two-cell approach beside the statue', () => {
  for (let seed = 1; seed <= 80; seed++) {
    for (let floor = 1; floor <= 3; floor++) {
      const g = generateDungeonGeometry({ runSeed: seed, floor })
      const room = g.rooms.find(r => r.theme === 'shrine')
      const statue = g.decorations.find(d => d.roomId === room.id && d.kind === 'statue')
      assert.ok(statue, `seed ${seed}/${floor}: missing statue`)
      const top = statue.y - statue.footprint.height / 2
      const nav = buildNavGrid(g, { cellSize: TILE, actorRadius: RADIUS })

      // One mathematically valid sliver is not enough for joystick movement.
      // Keep two adjacent 16px center columns clear between the west shoreline
      // and the statue's grounded foot, then prove both are reachable.
      for (const x of [room.x + 24, room.x + 40]) {
        const point = { x, y: top + 73 }
        assert.equal(circleHitsSolid(point, RADIUS, g), false,
          `seed ${seed}/${floor}: statue flank choke at ${point.x},${point.y}`)
        assert.ok(findPath(nav, room.center, point).length,
          `seed ${seed}/${floor}: statue flank is not reachable at ${point.x},${point.y}`)
      }

      // The broad foreground above a terrace lip must still be accessible from
      // the room center; this is the empty ground highlighted in the screenshot.
      for (const point of [
        { x: room.x + 40, y: top + 96 },
        { x: room.x + 56, y: top + 96 },
        { x: room.x + 72, y: top + 96 },
      ]) {
        if (circleHitsSolid(point, RADIUS, g)) continue
        assert.ok(findPath(nav, room.center, point).length,
          `seed ${seed}/${floor}: statue foreground is isolated at ${point.x},${point.y}`)
      }
    }
  }
})
