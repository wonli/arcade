import test from 'node:test'
import assert from 'node:assert/strict'

import { circleHitsSolid, clipSegmentToSolids, movementWithCollision, terrainAt } from './spatial.js'

const geometry = {
  width: 960,
  height: 600,
  solids: [
    { x: 0, y: 0, width: 960, height: 48 },
    { x: 300, y: 240, width: 120, height: 48 },
  ],
  water: [{ x: 500, y: 250, width: 160, height: 120 }],
}

test('solid geometry blocks circular actors', () => {
  assert.equal(circleHitsSolid({ x: 350, y: 265 }, 16, geometry), true)
  assert.equal(circleHitsSolid({ x: 200, y: 200 }, 16, geometry), false)
})

test('movement collision slides along an obstacle instead of entering it', () => {
  const next = movementWithCollision({ x: 270, y: 300 }, { x: 60, y: -30 }, 16, geometry)
  assert.ok(next.x < 300)
  assert.ok(next.y < 300)
  assert.equal(circleHitsSolid(next, 16, geometry), false)
})

test('water is traversable terrain with a slow multiplier', () => {
  assert.deepEqual(terrainAt({ x: 540, y: 300 }, geometry), { type: 'water', speedMultiplier: 0.62, navCost: 2.4 })
  assert.deepEqual(terrainAt({ x: 200, y: 200 }, geometry), { type: 'floor', speedMultiplier: 1, navCost: 1 })
})

test('beam segments clip at the first solid wall', () => {
  const clipped = clipSegmentToSolids({ x: 200, y: 264 }, { x: 600, y: 264 }, geometry)
  assert.ok(clipped.x >= 280 && clipped.x <= 285)
  assert.equal(clipped.y, 264)
  assert.equal(clipped.blocked, true)
})
