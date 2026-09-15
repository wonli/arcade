import assert from 'node:assert/strict'
import test from 'node:test'

import { generateDungeonGeometry } from './map-generator.js'
import { rngFor } from './deterministic-rng.js'

function compactGeometry(geometry) {
  return {
    seed: geometry.seed,
    floor: geometry.floor,
    spawn: geometry.spawn,
    exit: geometry.exit,
    chests: geometry.chests,
    rooms: geometry.rooms?.map((room) => ({ id: room.id, x: room.x, y: room.y, width: room.width, height: room.height, theme: room.theme })),
    water: geometry.water,
    traps: geometry.traps,
  }
}

test('two peers with the same room seed and floor build the same static world', () => {
  const p1 = generateDungeonGeometry({ runSeed: 'ABCDEF', floor: 7 })
  const p2 = generateDungeonGeometry({ runSeed: 'ABCDEF', floor: 7 })
  assert.deepEqual(compactGeometry(p1), compactGeometry(p2))
})

test('enemy setup stream is stable per spawn index and independent from other streams', () => {
  const p1 = rngFor('ABCDEF', 7, 'enemy', '3:normal')
  const expected = [p1(), p1(), p1(), p1()]

  const unrelated = rngFor('ABCDEF', 7, 'chest', 'chest-0')
  for (let index = 0; index < 30; index++) unrelated()

  const p2 = rngFor('ABCDEF', 7, 'enemy', '3:normal')
  assert.deepEqual([p2(), p2(), p2(), p2()], expected)
})

test('new room or new floor produces a different static seed', () => {
  const base = generateDungeonGeometry({ runSeed: 'ABCDEF', floor: 2 })
  const otherRoom = generateDungeonGeometry({ runSeed: 'UVWXYZ', floor: 2 })
  const otherFloor = generateDungeonGeometry({ runSeed: 'ABCDEF', floor: 3 })
  assert.notEqual(base.seed, otherRoom.seed)
  assert.notEqual(base.seed, otherFloor.seed)
})
