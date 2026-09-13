import test from 'node:test'
import assert from 'node:assert/strict'
import { generateDungeonGeometry } from './map-generator.js'
import { circleHitsSolid } from './spatial.js'

const TILE = 16
const PLAYER_RADIUS = 18

function sampleSafeLane(room) {
  const lane = room.layout?.safeLane
  if (!lane) return []
  const left = Math.ceil((lane.x + PLAYER_RADIUS) / TILE) * TILE
  const right = Math.floor((lane.x + lane.width - PLAYER_RADIUS) / TILE) * TILE
  const top = Math.ceil((Math.max(lane.y, room.y + TILE * 3) + PLAYER_RADIUS) / TILE) * TILE
  const bottom = Math.floor((Math.min(lane.y + lane.height, room.y + room.height - TILE * 2) - PLAYER_RADIUS) / TILE) * TILE
  const points = []
  for (let y = top; y <= bottom; y += TILE) {
    for (let x = left; x <= right; x += TILE) points.push({ x, y })
  }
  return points
}

test('themed safe lanes stay physically walkable after loose decoration placement', () => {
  for (let seed = 1; seed <= 400; seed++) {
    for (let floor = 1; floor <= 3; floor++) {
      const geometry = generateDungeonGeometry({ runSeed: seed, floor })
      for (const room of geometry.rooms) {
        for (const point of sampleSafeLane(room)) {
          assert.equal(
            circleHitsSolid(point, PLAYER_RADIUS, geometry),
            false,
            `seed ${seed} floor ${floor}: ${room.theme} room ${room.id} blocks reserved safe lane at ${point.x},${point.y}`,
          )
        }
      }
    }
  }
})
