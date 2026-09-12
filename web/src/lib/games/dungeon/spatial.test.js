import test from 'node:test'
import assert from 'node:assert/strict'

import { ROOM_TEMPLATES, circleHitsSolid, clipSegmentToSolids, movementWithCollision, roomGeometry, terrainAt } from './spatial.js'

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

test('water is forbidden terrain and blocks movement', () => {
  assert.deepEqual(terrainAt({ x: 540, y: 300 }, geometry), { type: 'water', speedMultiplier: 0, navCost: Infinity })
  assert.deepEqual(terrainAt({ x: 200, y: 200 }, geometry), { type: 'floor', speedMultiplier: 1, navCost: 1 })
  const next = movementWithCollision({ x: 470, y: 300 }, { x: 80, y: 0 }, 16, geometry)
  assert.ok(next.x < 484)
  assert.equal(terrainAt(next, geometry).type, 'floor')
})

test('beam segments clip at the first solid wall', () => {
  const clipped = clipSegmentToSolids({ x: 200, y: 264 }, { x: 600, y: 264 }, geometry)
  assert.ok(clipped.x >= 280 && clipped.x <= 285)
  assert.equal(clipped.y, 264)
  assert.equal(clipped.blocked, true)
})

test('every room template keeps player start, portal, and enemy spawn anchors clear', () => {
  for (const template of ROOM_TEMPLATES) {
    const room = roomGeometry(template, 1, () => 0)
    assert.equal(circleHitsSolid({ x: 480, y: 300 }, 18, room), false, `${template} blocks player start`)
    assert.equal(circleHitsSolid({ x: 480, y: 518 }, 18, room), false, `${template} blocks portal`)
    for (const spawn of room.spawnPoints) {
      assert.equal(circleHitsSolid(spawn, 15, room), false, `${template} blocks spawn ${spawn.x},${spawn.y}`)
    }
  }
})

test('bridge exemption covers only the deck, not an actor hanging over the side', () => {
  const g = { solids: [], water: [{ x: 40, y: 0, width: 80, height: 160 }], bridges: [{ x: 16, y: 48, width: 128, height: 64 }] }
  assert.equal(circleHitsSolid({ x: 80, y: 80 }, 18, g), false)
  assert.equal(circleHitsSolid({ x: 80, y: 52 }, 18, g), true)
  assert.equal(circleHitsSolid({ x: 36, y: 80 }, 18, g), false)
})

test('explicit run seed makes procedural geometry deterministic across clients', () => {
  const first = roomGeometry(null, 4, () => 0.11, { runSeed: 'ROOM42' })
  const second = roomGeometry(null, 4, () => 0.91, { runSeed: 'ROOM42' })
  const otherRoom = roomGeometry(null, 4, () => 0.11, { runSeed: 'OTHER99' })

  assert.deepEqual(second, first)
  assert.notEqual(otherRoom.seed, first.seed)
})
