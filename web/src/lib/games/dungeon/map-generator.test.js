import test from 'node:test'
import assert from 'node:assert/strict'

import { generateDungeonGeometry } from './map-generator.js'
import { buildNavGrid, findPath } from './pathfinding.js'

function route(geometry, start, goal, profile = 'ground') {
  return findPath(buildNavGrid(geometry, { cellSize: 32, actorRadius: 14, profile }), start, goal)
}

function pointInRect(point, area, padding = 0) {
  return point.x >= area.x - padding && point.x <= area.x + area.width + padding && point.y >= area.y - padding && point.y <= area.y + area.height + padding
}

function onBridge(geometry, point) {
  return geometry.bridges.some((bridge) => pointInRect(point, bridge))
}

function onWater(geometry, point) {
  return geometry.water.some((water) => pointInRect(point, water)) && !onBridge(geometry, point)
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
  assert.equal(geometry.solids.filter((solid) => solid.kind === 'wall').length, 0)
})

test('spawn exit and every reusable spawn point are actual dry ground cells', () => {
  const seenSpawn = new Set()
  const seenExit = new Set()
  for (let seed = 1; seed <= 120; seed++) {
    const geometry = generateDungeonGeometry({ runSeed: seed, floor: (seed % 12) + 1 })
    seenSpawn.add(`${Math.round(geometry.spawn.x / 16)},${Math.round(geometry.spawn.y / 16)}`)
    seenExit.add(`${Math.round(geometry.exit.x / 16)},${Math.round(geometry.exit.y / 16)}`)
    for (const [label, point] of [['spawn', geometry.spawn], ['exit', geometry.exit], ...geometry.spawnPoints.map((point, index) => [`spawnPoint-${index}`, point])]) {
      assert.equal(onWater(geometry, point), false, `seed ${seed} ${label} landed in water`)
      assert.ok(point.x >= geometry.bounds.x + 20 && point.x <= geometry.bounds.x + geometry.bounds.width - 20, `seed ${seed} ${label} outside horizontal floor`)
      assert.ok(point.y >= geometry.bounds.y + 20 && point.y <= geometry.bounds.y + geometry.bounds.height - 20, `seed ${seed} ${label} outside vertical floor`)
    }
  }
  assert.ok(seenSpawn.size > 24, `spawn is not random enough: ${seenSpawn.size}`)
  assert.ok(seenExit.size > 24, `exit is not random enough: ${seenExit.size}`)
})

test('generated maps keep spawn exit chest and bridge crossings reachable', () => {
  for (let seed = 1; seed <= 120; seed++) {
    const geometry = generateDungeonGeometry({ runSeed: seed, floor: (seed % 12) + 1 })
    const spawn = geometry.spawn
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

test('architectural columns are generated as authored pairs instead of isolated random pillars', () => {
  for (let seed = 1; seed <= 80; seed++) {
    const geometry = generateDungeonGeometry({ runSeed: seed, floor: 3 })
    const pillars = geometry.solids.filter((solid) => solid.kind === 'pillar')
    assert.equal(pillars.length % 2, 0, `seed ${seed} has an orphan pillar`)
    for (const pillar of pillars) {
      const center = { x: pillar.x + pillar.width / 2, y: pillar.y + pillar.height / 2 }
      const partner = pillars.some((other) => other !== pillar && Math.hypot(other.x + other.width / 2 - center.x, other.y + other.height / 2 - center.y) <= 96)
      assert.ok(partner, `seed ${seed} has an isolated pillar`)
    }
  }
})

test('large decorations use explicit authored footprints and stay away from the critical route', () => {
  for (let seed = 1; seed <= 60; seed++) {
    const geometry = generateDungeonGeometry({ runSeed: seed, floor: 4 })
    for (const decoration of geometry.decorations.filter((entry) => entry.kind !== 'plate')) {
      assert.ok(decoration.footprint?.width >= 32 && decoration.footprint?.height >= 32, `seed ${seed} ${decoration.kind} missing authored footprint`)
      for (const anchor of geometry.criticalPath) {
        assert.ok(Math.hypot(anchor.x - decoration.x, anchor.y - decoration.y) >= 72, `seed ${seed} ${decoration.kind} blocks critical route`)
      }
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
