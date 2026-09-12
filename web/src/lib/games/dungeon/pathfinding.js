import { circleHitsSolid, terrainAt } from './spatial.js'

function key(x, y) {
  return `${x},${y}`
}

export function buildNavGrid(geometry, { cellSize = 48, actorRadius = 14 } = {}) {
  const width = Math.max(1, Math.ceil((geometry?.width ?? 960) / cellSize))
  const height = Math.max(1, Math.ceil((geometry?.height ?? 600) / cellSize))
  const cells = new Map()
  for (let cellY = 0; cellY < height; cellY++) {
    for (let cellX = 0; cellX < width; cellX++) {
      const x = Math.min((geometry?.width ?? width * cellSize) - 1, cellX * cellSize + cellSize / 2)
      const y = Math.min((geometry?.height ?? height * cellSize) - 1, cellY * cellSize + cellSize / 2)
      const blocked = circleHitsSolid({ x, y }, actorRadius, geometry)
      const terrain = terrainAt({ x, y }, geometry)
      cells.set(key(cellX, cellY), {
        cellX,
        cellY,
        x,
        y,
        blocked,
        terrain: terrain.type,
        cost: blocked ? Infinity : terrain.navCost,
      })
    }
  }
  return { width, height, cellSize, actorRadius, cells }
}

export function navCostAt(grid, cell) {
  return grid?.cells?.get(key(cell?.x ?? -1, cell?.y ?? -1))?.cost ?? Infinity
}

function closestCell(grid, position) {
  const cellX = Math.max(0, Math.min(grid.width - 1, Math.floor((position?.x ?? 0) / grid.cellSize)))
  const cellY = Math.max(0, Math.min(grid.height - 1, Math.floor((position?.y ?? 0) / grid.cellSize)))
  return grid.cells.get(key(cellX, cellY)) ?? null
}

function heuristic(a, b) {
  return Math.abs(a.cellX - b.cellX) + Math.abs(a.cellY - b.cellY)
}

function reconstruct(cameFrom, current, grid) {
  const out = [current]
  let currentKey = key(current.cellX, current.cellY)
  while (cameFrom.has(currentKey)) {
    currentKey = cameFrom.get(currentKey)
    const node = grid.cells.get(currentKey)
    if (!node) break
    out.push(node)
  }
  return out.reverse().map((node) => ({
    x: node.x,
    y: node.y,
    cellX: node.cellX,
    cellY: node.cellY,
    terrain: node.terrain,
  }))
}

export function findPath(grid, start, goal) {
  if (!grid?.cells?.size) return []
  const startNode = closestCell(grid, start)
  const goalNode = closestCell(grid, goal)
  if (!startNode || !goalNode || startNode.blocked || goalNode.blocked) return []

  const startKey = key(startNode.cellX, startNode.cellY)
  const goalKey = key(goalNode.cellX, goalNode.cellY)
  const open = new Set([startKey])
  const cameFrom = new Map()
  const gScore = new Map([[startKey, 0]])
  const fScore = new Map([[startKey, heuristic(startNode, goalNode)]])
  const directions = [[1, 0], [-1, 0], [0, 1], [0, -1]]

  while (open.size) {
    let currentKey = null
    let currentScore = Infinity
    for (const candidate of open) {
      const score = fScore.get(candidate) ?? Infinity
      if (score < currentScore) {
        currentScore = score
        currentKey = candidate
      }
    }
    if (!currentKey) break
    const current = grid.cells.get(currentKey)
    if (currentKey === goalKey) return reconstruct(cameFrom, current, grid)
    open.delete(currentKey)

    for (const [dx, dy] of directions) {
      const nx = current.cellX + dx
      const ny = current.cellY + dy
      const neighborKey = key(nx, ny)
      const neighbor = grid.cells.get(neighborKey)
      if (!neighbor || neighbor.blocked || !Number.isFinite(neighbor.cost)) continue
      const tentative = (gScore.get(currentKey) ?? Infinity) + neighbor.cost
      if (tentative >= (gScore.get(neighborKey) ?? Infinity)) continue
      cameFrom.set(neighborKey, currentKey)
      gScore.set(neighborKey, tentative)
      fScore.set(neighborKey, tentative + heuristic(neighbor, goalNode))
      open.add(neighborKey)
    }
  }
  return []
}

export function nextWaypoint(path, position, tolerance = 18) {
  if (!Array.isArray(path) || !path.length) return null
  let index = 0
  while (index < path.length - 1 && Math.hypot(path[index].x - position.x, path[index].y - position.y) <= tolerance) index++
  return path[index] ?? null
}
