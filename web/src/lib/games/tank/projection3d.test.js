import assert from 'node:assert/strict'
import test from 'node:test'
import { createProjection, offsetAlong, projectPoint, rotatedRectangleCorners, screenToWorld } from './projection3d.js'

test('ground points round-trip through the fixed camera projection', () => {
  const projection = createProjection({ worldWidth: 1200, worldHeight: 720, viewportWidth: 1000, viewportHeight: 600 })
  for (const point of [{ x: 0, y: 0 }, { x: 600, y: 360 }, { x: 1175, y: 701 }]) {
    const screen = projectPoint(projection, point.x, point.y, 0)
    const world = screenToWorld(projection, screen.x, screen.y)
    assert.ok(Math.abs(world.x - point.x) < 1e-9)
    assert.ok(Math.abs(world.y - point.y) < 1e-9)
  }
})

test('height moves geometry toward the camera without changing x', () => {
  const projection = createProjection({ worldWidth: 1200, worldHeight: 720, viewportWidth: 1000, viewportHeight: 600 })
  const ground = projectPoint(projection, 420, 300, 0)
  const raised = projectPoint(projection, 420, 300, 50)
  assert.equal(raised.x, ground.x)
  assert.ok(raised.y < ground.y)
  assert.ok(Math.abs((ground.y - raised.y) - 50 * projection.scale * projection.sinTilt) < 1e-9)
})

test('projection reserves room for the tallest renderable geometry', () => {
  const projection = createProjection({ worldWidth: 1200, worldHeight: 720, viewportWidth: 1000, viewportHeight: 600, padding: 16, maxHeight: 90 })
  const top = projectPoint(projection, 0, 0, 90)
  const bottom = projectPoint(projection, 1200, 720, 0)
  assert.ok(top.x >= 16 - 1e-9)
  assert.ok(top.y >= 16 - 1e-9)
  assert.ok(bottom.x <= 1000 - 16 + 1e-9)
  assert.ok(bottom.y <= 600 - 16 + 1e-9)
})

test('rotated tank footprint keeps its requested dimensions', () => {
  const corners = rotatedRectangleCorners(100, 80, 60, 36, Math.PI / 3)
  const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y)
  assert.ok(Math.abs(distance(corners[0], corners[1]) - 60) < 1e-9)
  assert.ok(Math.abs(distance(corners[1], corners[2]) - 36) < 1e-9)
  const center = corners.reduce((acc, point) => ({ x: acc.x + point.x / 4, y: acc.y + point.y / 4 }), { x: 0, y: 0 })
  assert.ok(Math.abs(center.x - 100) < 1e-9)
  assert.ok(Math.abs(center.y - 80) < 1e-9)
})

test('offsetAlong follows the server angle convention', () => {
  assert.deepEqual(offsetAlong(10, 20, 15, 0), { x: 25, y: 20 })
  const down = offsetAlong(10, 20, 15, Math.PI / 2)
  assert.ok(Math.abs(down.x - 10) < 1e-9)
  assert.ok(Math.abs(down.y - 35) < 1e-9)
})
