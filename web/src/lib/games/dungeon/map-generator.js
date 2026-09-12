import { hasRoute } from './pathfinding.js'

const WIDTH = 960
const HEIGHT = 600
const BORDER = 48
const SAFE_RADIUS = 20

const point = (x, y, extra = {}) => ({ x, y, ...extra })
const rect = (x, y, width, height, kind, extra = {}) => ({ x, y, width, height, kind, ...extra })

function hashSeed(value) {
  const text = String(value ?? 'dungeon')
  let hash = 2166136261 >>> 0
  for (let index = 0; index < text.length; index++) {
    hash ^= text.charCodeAt(index)
    hash = Math.imul(hash, 16777619)
  }
  return hash >>> 0
}

function mulberry32(seed) {
  let state = seed >>> 0
  return () => {
    state += 0x6D2B79F5
    let t = state
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function floorSeed(runSeed, floor) {
  return hashSeed(`${runSeed}:${Math.max(1, Math.floor(floor || 1))}`)
}

function pick(random, values) {
  return values[Math.floor(random() * values.length) % values.length]
}

function integer(random, min, max) {
  return min + Math.floor(random() * (max - min + 1))
}

function boundaries() {
  return [
    rect(0, 0, WIDTH, BORDER, 'boundary'),
    rect(0, HEIGHT - BORDER, WIDTH, BORDER, 'boundary'),
    rect(0, BORDER, BORDER, HEIGHT - BORDER * 2, 'boundary'),
    rect(WIDTH - BORDER, BORDER, BORDER, HEIGHT - BORDER * 2, 'boundary'),
  ]
}

function pointInRect(position, area, padding = 0) {
  return position.x >= area.x - padding && position.x <= area.x + area.width + padding && position.y >= area.y - padding && position.y <= area.y + area.height + padding
}

function circleRectIntersects(position, radius, area) {
  const nearestX = Math.max(area.x, Math.min(area.x + area.width, position.x))
  const nearestY = Math.max(area.y, Math.min(area.y + area.height, position.y))
  const dx = position.x - nearestX
  const dy = position.y - nearestY
  return dx * dx + dy * dy < radius * radius
}

function rectsOverlap(a, b, padding = 0) {
  return a.x < b.x + b.width + padding && a.x + a.width > b.x - padding && a.y < b.y + b.height + padding && a.y + a.height > b.y - padding
}

function onBridge(geometry, position) {
  return (geometry.bridges ?? []).some((bridge) => pointInRect(position, bridge))
}

function dryGround(geometry, position, radius = SAFE_RADIUS) {
  const bounds = geometry.bounds
  if (position.x < bounds.x + radius || position.x > bounds.x + bounds.width - radius || position.y < bounds.y + radius || position.y > bounds.y + bounds.height - radius) return false
  if ((geometry.solids ?? []).some((solid) => circleRectIntersects(position, radius, solid))) return false
  if (onBridge(geometry, position)) return true
  return !(geometry.water ?? []).some((water) => circleRectIntersects(position, radius, water))
}

function shuffledGroundCandidates(random, geometry, predicate = () => true, step = 16) {
  const candidates = []
  const minX = geometry.bounds.x + SAFE_RADIUS + 8
  const maxX = geometry.bounds.x + geometry.bounds.width - SAFE_RADIUS - 8
  const minY = geometry.bounds.y + SAFE_RADIUS + 8
  const maxY = geometry.bounds.y + geometry.bounds.height - SAFE_RADIUS - 8
  for (let y = minY; y <= maxY; y += step) {
    for (let x = minX; x <= maxX; x += step) {
      const candidate = point(x, y)
      if (predicate(candidate) && dryGround(geometry, candidate)) candidates.push(candidate)
    }
  }
  for (let index = candidates.length - 1; index > 0; index--) {
    const swap = Math.floor(random() * (index + 1))
    ;[candidates[index], candidates[swap]] = [candidates[swap], candidates[index]]
  }
  return candidates
}

function farEnough(position, anchors, distance) {
  return anchors.every((anchor) => Math.hypot(anchor.x - position.x, anchor.y - position.y) >= distance)
}

function chooseGroundPoint(random, geometry, predicate, anchors = [], minDistance = 0) {
  return shuffledGroundCandidates(random, geometry, predicate).find((candidate) => farEnough(candidate, anchors, minDistance)) ?? null
}

function architecturePillars(geometry, bridge) {
  const horizontal = bridge.width >= bridge.height
  const result = []
  const addPair = (a, b) => {
    for (const center of [a, b]) {
      if (!dryGround(geometry, center, 18)) return
    }
    result.push(rect(a.x - 16, a.y - 16, 32, 32, 'pillar', { group: 'column-pair' }))
    result.push(rect(b.x - 16, b.y - 16, 32, 32, 'pillar', { group: 'column-pair' }))
  }

  if (horizontal) {
    const centerY = bridge.y + bridge.height / 2
    const leftX = bridge.x - 34
    const rightX = bridge.x + bridge.width + 34
    addPair(point(leftX, centerY - 32), point(leftX, centerY + 32))
    addPair(point(rightX, centerY - 32), point(rightX, centerY + 32))
  } else {
    const centerX = bridge.x + bridge.width / 2
    const topY = bridge.y - 34
    const bottomY = bridge.y + bridge.height + 34
    addPair(point(centerX - 32, topY), point(centerX + 32, topY))
    addPair(point(centerX - 32, bottomY), point(centerX + 32, bottomY))
  }
  return result
}

function footprintRect(entry) {
  const width = entry.footprint?.width ?? 16
  const height = entry.footprint?.height ?? 16
  return rect(entry.x - width / 2, entry.y - height / 2, width, height, 'decoration')
}

function placeDecoration(random, geometry, kind, footprint, protectedAnchors, existing, attempts = 80) {
  for (let attempt = 0; attempt < attempts; attempt++) {
    const candidate = chooseGroundPoint(random, geometry, () => true, protectedAnchors, 88)
    if (!candidate) return null
    const entry = point(candidate.x, candidate.y, { kind, footprint: { ...footprint } })
    const area = footprintRect(entry)
    if (geometry.water.some((water) => rectsOverlap(area, water, 8))) continue
    if (geometry.solids.some((solid) => rectsOverlap(area, solid, 10))) continue
    if (existing.some((other) => rectsOverlap(area, footprintRect(other), 20))) continue
    return entry
  }
  return null
}

function placeSafePoint(random, geometry, protectedAnchors, minDistance = 72) {
  return chooseGroundPoint(random, geometry, () => true, protectedAnchors, minDistance)
}

function buildCandidate(seed, floor, attempt) {
  const random = mulberry32((seed + attempt * 0x9e3779b9) >>> 0)
  const verticalRiver = random() < 0.5
  const riverThickness = pick(random, [80, 96, 112])
  const bridgeThickness = pick(random, [48, 56])
  const water = []
  const bridges = []
  const stairs = []

  if (verticalRiver) {
    const riverX = integer(random, 360, 504)
    const bridgeY = integer(random, 170, 382)
    water.push(rect(riverX, BORDER, riverThickness, HEIGHT - BORDER * 2, 'water', { role: 'river' }))
    bridges.push(rect(riverX - 32, bridgeY, riverThickness + 64, bridgeThickness, 'bridge', { orientation: 'horizontal' }))
  } else {
    const riverY = integer(random, 198, 322)
    const bridgeX = integer(random, 300, 604)
    water.push(rect(BORDER, riverY, WIDTH - BORDER * 2, riverThickness, 'water', { role: 'river' }))
    bridges.push(rect(bridgeX, riverY - 32, bridgeThickness, riverThickness + 64, 'bridge', { orientation: 'vertical' }))
  }

  const geometry = {
    name: 'procedural-river', seed, floor, width: WIDTH, height: HEIGHT,
    bounds: { x: BORDER, y: BORDER, width: WIDTH - BORDER * 2, height: HEIGHT - BORDER * 2 },
    solids: boundaries(), water, bridges, stairs, doors: [], traps: [], decorations: [], torches: [], chests: [], spawnPoints: [],
    spawn: null, exit: null, criticalPath: [],
  }

  const bridge = bridges[0]
  const horizontalBridge = bridge.width >= bridge.height
  if (horizontalBridge) {
    stairs.push(point(bridge.x - 18, bridge.y + bridge.height / 2, { orientation: 'right', role: 'bridge-step' }))
    stairs.push(point(bridge.x + bridge.width + 18, bridge.y + bridge.height / 2, { orientation: 'left', role: 'bridge-step' }))
  } else {
    stairs.push(point(bridge.x + bridge.width / 2, bridge.y - 18, { orientation: 'down', role: 'bridge-step' }))
    stairs.push(point(bridge.x + bridge.width / 2, bridge.y + bridge.height + 18, { orientation: 'up', role: 'bridge-step' }))
  }

  geometry.solids.push(...architecturePillars(geometry, bridge))

  const river = water[0]
  const bankA = verticalRiver
    ? (candidate) => candidate.x < river.x - 36
    : (candidate) => candidate.y < river.y - 36
  const bankB = verticalRiver
    ? (candidate) => candidate.x > river.x + river.width + 36
    : (candidate) => candidate.y > river.y + river.height + 36
  const swapBanks = random() < 0.5
  const spawnBank = swapBanks ? bankB : bankA
  const exitBank = swapBanks ? bankA : bankB
  geometry.spawn = chooseGroundPoint(random, geometry, spawnBank)
  if (!geometry.spawn) return geometry
  geometry.exit = chooseGroundPoint(random, geometry, exitBank, [geometry.spawn], 420)
  if (!geometry.exit) return geometry
  geometry.criticalPath = [geometry.spawn, point(bridge.x + bridge.width / 2, bridge.y + bridge.height / 2), geometry.exit]
  geometry.doors.push(point(geometry.exit.x, geometry.exit.y, { role: 'exit', side: 'floor' }))

  if (random() < 0.52) {
    const poolWidth = pick(random, [112, 128, 144])
    const poolHeight = pick(random, [80, 96, 112])
    for (let attemptIndex = 0; attemptIndex < 30; attemptIndex++) {
      const pool = rect(integer(random, 96, WIDTH - 96 - poolWidth), integer(random, 96, HEIGHT - 96 - poolHeight), poolWidth, poolHeight, 'water', { role: 'pool' })
      if ([geometry.spawn, geometry.exit, ...geometry.criticalPath].some((anchor) => pointInRect(anchor, pool, 64))) continue
      if (geometry.bridges.some((entry) => rectsOverlap(entry, pool, 48))) continue
      water.push(pool)
      break
    }
  }

  const spawnPool = [geometry.spawn]
  while (geometry.spawnPoints.length < 6) {
    const candidate = placeSafePoint(random, geometry, [...spawnPool, geometry.exit], 88)
    if (!candidate) break
    geometry.spawnPoints.push(candidate)
    spawnPool.push(candidate)
  }
  geometry.spawnPoints.unshift(geometry.spawn)

  const chest = placeSafePoint(random, geometry, [geometry.spawn, geometry.exit, ...geometry.criticalPath], 110)
  if (chest) geometry.chests.push(chest)

  const decorations = []
  const authoredSetPieces = [
    ['statue', { width: 80, height: 80 }],
    ['coffin', { width: 48, height: 32 }],
    ['coffin', { width: 48, height: 32 }],
  ]
  for (const [kind, footprint] of authoredSetPieces) {
    if (kind === 'statue' && random() > 0.72) continue
    const decoration = placeDecoration(random, geometry, kind, footprint, [geometry.spawn, geometry.exit, ...geometry.criticalPath, ...geometry.chests], decorations)
    if (decoration) decorations.push(decoration)
  }
  for (let index = 0; index < 4; index++) {
    const plate = placeDecoration(random, geometry, 'plate', { width: 16, height: 16 }, [geometry.spawn, geometry.exit, ...geometry.criticalPath], decorations, 30)
    if (plate) decorations.push(plate)
  }
  geometry.decorations = decorations

  for (let index = 0; index < 2; index++) {
    const trap = placeSafePoint(random, geometry, [geometry.spawn, geometry.exit, ...geometry.criticalPath, ...geometry.chests], 96)
    if (trap) geometry.traps.push(point(trap.x, trap.y, { kind: index % 2 === 0 ? 'plate-trap' : 'spikes' }))
  }

  const bridgeCenter = point(bridge.x + bridge.width / 2, bridge.y + bridge.height / 2)
  const torchCandidates = verticalRiver
    ? [point(104, 92), point(856, 92), point(104, 508), point(856, 508), point(bridge.x - 54, bridgeCenter.y - 54), point(bridge.x + bridge.width + 54, bridgeCenter.y + 54)]
    : [point(104, 92), point(856, 92), point(104, 508), point(856, 508), point(bridgeCenter.x - 54, bridge.y - 54), point(bridgeCenter.x + 54, bridge.y + bridge.height + 54)]
  geometry.torches = torchCandidates.filter((entry) => dryGround(geometry, entry, 10))

  return geometry
}

function validCandidate(geometry) {
  if (!geometry.spawn || !geometry.exit) return false
  if (!dryGround(geometry, geometry.spawn) || !dryGround(geometry, geometry.exit)) return false
  if (!geometry.spawnPoints.length || geometry.spawnPoints.some((entry) => !dryGround(geometry, entry))) return false
  if (!hasRoute(geometry, geometry.spawn, geometry.exit, { cellSize: 32, actorRadius: 14 })) return false
  for (const chest of geometry.chests) if (!hasRoute(geometry, geometry.spawn, chest, { cellSize: 32, actorRadius: 14 })) return false
  for (const bridge of geometry.bridges) {
    const horizontal = bridge.width >= bridge.height
    const a = horizontal ? point(bridge.x - 20, bridge.y + bridge.height / 2) : point(bridge.x + bridge.width / 2, bridge.y - 20)
    const b = horizontal ? point(bridge.x + bridge.width + 20, bridge.y + bridge.height / 2) : point(bridge.x + bridge.width / 2, bridge.y + bridge.height + 20)
    if (!hasRoute(geometry, a, b, { cellSize: 32, actorRadius: 12 })) return false
  }
  return true
}

function safeFallback(seed, floor) {
  const random = mulberry32(seed ^ 0xa5a5a5a5)
  const river = rect(440, BORDER, 80, HEIGHT - BORDER * 2, 'water', { role: 'river' })
  const bridge = rect(408, 272, 144, 56, 'bridge', { orientation: 'horizontal' })
  const geometry = {
    name: 'procedural-safe', seed, floor, width: WIDTH, height: HEIGHT,
    bounds: { x: BORDER, y: BORDER, width: WIDTH - BORDER * 2, height: HEIGHT - BORDER * 2 },
    solids: boundaries(), water: [river], bridges: [bridge], stairs: [], doors: [], traps: [], decorations: [], torches: [], chests: [], spawnPoints: [], spawn: null, exit: null, criticalPath: [],
  }
  geometry.solids.push(...architecturePillars(geometry, bridge))
  geometry.spawn = chooseGroundPoint(random, geometry, (candidate) => candidate.x < river.x - 48) ?? point(112, 300)
  geometry.exit = chooseGroundPoint(random, geometry, (candidate) => candidate.x > river.x + river.width + 48, [geometry.spawn], 420) ?? point(848, 300)
  geometry.spawnPoints = [geometry.spawn]
  for (let index = 0; index < 5; index++) {
    const candidate = placeSafePoint(random, geometry, [...geometry.spawnPoints, geometry.exit], 80)
    if (candidate) geometry.spawnPoints.push(candidate)
  }
  geometry.criticalPath = [geometry.spawn, point(480, 300), geometry.exit]
  geometry.stairs = [point(390, 300, { orientation: 'right', role: 'bridge-step' }), point(570, 300, { orientation: 'left', role: 'bridge-step' })]
  geometry.doors = [point(geometry.exit.x, geometry.exit.y, { role: 'exit', side: 'floor' })]
  geometry.torches = [point(120, 100), point(840, 100), point(120, 500), point(840, 500)]
  const chest = placeSafePoint(random, geometry, [geometry.spawn, geometry.exit, ...geometry.criticalPath], 100)
  if (chest) geometry.chests.push(chest)
  return geometry
}

export function generateDungeonGeometry({ runSeed = 1, floor = 1 } = {}) {
  const seed = floorSeed(runSeed, floor)
  for (let attempt = 0; attempt < 32; attempt++) {
    const candidate = buildCandidate(seed, floor, attempt)
    if (validCandidate(candidate)) return candidate
  }
  return safeFallback(seed, floor)
}

export { floorSeed }
