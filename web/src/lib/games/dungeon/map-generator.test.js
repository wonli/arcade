import test from 'node:test'
import assert from 'node:assert/strict'

import { generateDungeonGeometry } from './map-generator.js'
import { buildNavGrid, findPath } from './pathfinding.js'

function route(geometry, start, goal, profile = 'ground') {
  return findPath(buildNavGrid(geometry, { cellSize: 32, actorRadius: 14, profile }), start, goal)
}

test('same run seed and floor produce stable geometry', () => {
  const a = generateDungeonGeometry({ runSeed: 12345, floor: 7 })
  const b = generateDungeonGeometry({ runSeed: 12345, floor: 7 })
  assert.deepEqual(a, b)
})

test('different run seeds produce different layouts', () => {
  const a = generateDungeonGeometry({ runSeed: 111, floor: 3 })
  const b = generateDungeonGeometry({ runSeed: 222, floor: 3 })
  assert.notDeepEqual(a.water, b.water)
})

test('generated maps use rivers and bridges instead of mandatory middle wall bars', () => {
  const geometry = generateDungeonGeometry({ runSeed: 77, floor: 2 })
  assert.ok(geometry.water.length >= 1)
  assert.ok(geometry.bridges.length >= 1)
  assert.ok(geometry.solids.filter((solid) => solid.kind === 'wall').length <= 2)
})

test('generated maps keep spawn exit chest and bridge crossings reachable', () => {
  for (let seed = 1; seed <= 100; seed++) {
    const geometry = generateDungeonGeometry({ runSeed: seed, floor: (seed % 12) + 1 })
    const spawn = geometry.spawnPoints[0]
    assert.ok(route(geometry, spawn, geometry.exit).length > 0, `seed ${seed} exit unreachable`)
    for (const chest of geometry.chests) assert.ok(route(geometry, spawn, chest).length > 0, `seed ${seed} chest unreachable`)
    for (const bridge of geometry.bridges) {
      const horizontal = bridge.width >= bridge.height
      const a = horizontal
        ? { x: bridge.x - 20, y: bridge.y + bridge.height / 2 }
        : { x: bridge.x + bridge.width / 2, y: bridge.y - 20 }
      const b = horizontal
        ? { x: bridge.x + bridge.width + 20, y: bridge.y + bridge.height / 2 }
        : { x: bridge.x + bridge.width / 2, y: bridge.y + bridge.height + 20 }
      assert.ok(route(geometry, a, b).length > 0, `seed ${seed} bridge unreachable`)
    }
  }
})

test('flying navigation may cross generated river directly', () => {
  const geometry = generateDungeonGeometry({ runSeed: 909, floor: 5 })
  const river = geometry.water[0]
  const horizontalRiver = river.width > river.height
  const a = horizontalRiver
    ? { x: river.x + river.width / 2, y: river.y - 36 }
    : { x: river.x - 36, y: river.y + river.height / 2 }
  const b = horizontalRiver
    ? { x: river.x + river.width / 2, y: river.y + river.height + 36 }
    : { x: river.x + river.width + 36, y: river.y + river.height / 2 }
  const flying = route(geometry, a, b, 'flying')
  assert.ok(flying.length > 0)
})
