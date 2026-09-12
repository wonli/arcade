import test from 'node:test'
import assert from 'node:assert/strict'

import { buildNavGrid, findPath, hasRoute, navCostAt } from './pathfinding.js'

const geometry = {
  width: 240,
  height: 192,
  solids: [{ x: 96, y: 48, width: 48, height: 96 }],
  water: [{ x: 48, y: 96, width: 48, height: 48 }],
}

test('ground nav grid blocks solids and water', () => {
  const grid = buildNavGrid(geometry, { cellSize: 48, actorRadius: 12, profile: 'ground' })
  assert.equal(navCostAt(grid, { x: 2, y: 1 }), Infinity)
  assert.equal(navCostAt(grid, { x: 1, y: 2 }), Infinity)
  assert.equal(navCostAt(grid, { x: 0, y: 2 }), 1)
})

test('flying nav grid crosses water but still blocks hard solids', () => {
  const grid = buildNavGrid(geometry, { cellSize: 48, actorRadius: 12, profile: 'flying' })
  assert.equal(navCostAt(grid, { x: 2, y: 1 }), Infinity)
  assert.equal(navCostAt(grid, { x: 1, y: 2 }), 1)
})

test('astar routes around a wall instead of crossing blocked cells', () => {
  const grid = buildNavGrid(geometry, { cellSize: 48, actorRadius: 12 })
  const path = findPath(grid, { x: 24, y: 72 }, { x: 216, y: 72 })
  assert.ok(path.length >= 5)
  assert.equal(path.some((node) => node.cellX === 2 && (node.cellY === 1 || node.cellY === 2)), false)
  assert.ok(path.at(-1).x > 190)
})

test('ground astar never routes through water', () => {
  const wide = {
    width: 288,
    height: 192,
    solids: [],
    water: [{ x: 96, y: 48, width: 96, height: 48 }],
  }
  const grid = buildNavGrid(wide, { cellSize: 48, actorRadius: 10, profile: 'ground' })
  const path = findPath(grid, { x: 24, y: 72 }, { x: 264, y: 72 })
  assert.equal(path.some((node) => node.terrain === 'water'), false)
  assert.ok(path.length > 0)
})

test('flying astar may cross water', () => {
  const wide = {
    width: 288,
    height: 144,
    solids: [],
    water: [{ x: 96, y: 0, width: 96, height: 144 }],
  }
  const grid = buildNavGrid(wide, { cellSize: 48, actorRadius: 10, profile: 'flying' })
  const path = findPath(grid, { x: 24, y: 72 }, { x: 264, y: 72 })
  assert.ok(path.length > 0)
  assert.ok(path.some((node) => node.terrain === 'water'))
})

test('hasRoute reuses astar connectivity checks', () => {
  assert.equal(hasRoute(geometry, { x: 24, y: 24 }, { x: 216, y: 168 }, { cellSize: 48 }), true)
})

test('ground navigation blocks cells whose actor radius overlaps a shoreline', () => {
  const geometry = { width: 128, height: 128, solids: [], bridges: [], water: [{ x: 64, y: 0, width: 64, height: 128 }] }
  const grid = buildNavGrid(geometry, { cellSize: 16, actorRadius: 18 })
  assert.equal(grid.cells.get('3,3').blocked, true)
  assert.equal(grid.cells.get('2,3').blocked, false)
})
