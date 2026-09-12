import test from 'node:test'
import assert from 'node:assert/strict'

import { buildNavGrid, findPath, navCostAt } from './pathfinding.js'

const geometry = {
  width: 240,
  height: 192,
  solids: [{ x: 96, y: 48, width: 48, height: 96 }],
  water: [{ x: 48, y: 96, width: 48, height: 48 }],
}

test('nav grid blocks solids and marks water as higher cost', () => {
  const grid = buildNavGrid(geometry, { cellSize: 48, actorRadius: 12 })
  assert.equal(navCostAt(grid, { x: 2, y: 1 }), Infinity)
  assert.ok(navCostAt(grid, { x: 1, y: 2 }) > navCostAt(grid, { x: 0, y: 2 }))
})

test('astar routes around a wall instead of crossing blocked cells', () => {
  const grid = buildNavGrid(geometry, { cellSize: 48, actorRadius: 12 })
  const path = findPath(grid, { x: 24, y: 72 }, { x: 216, y: 72 })
  assert.ok(path.length >= 5)
  assert.equal(path.some((node) => node.cellX === 2 && (node.cellY === 1 || node.cellY === 2)), false)
  assert.ok(path.at(-1).x > 190)
})

test('astar prefers a modest dry detour over expensive water', () => {
  const wide = {
    width: 288,
    height: 192,
    solids: [],
    water: [{ x: 96, y: 48, width: 96, height: 48 }],
  }
  const grid = buildNavGrid(wide, { cellSize: 48, actorRadius: 10 })
  const path = findPath(grid, { x: 24, y: 72 }, { x: 264, y: 72 })
  const waterCells = path.filter((node) => node.terrain === 'water')
  assert.equal(waterCells.length, 0)
})
