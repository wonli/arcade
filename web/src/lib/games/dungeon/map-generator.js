import { hasRoute } from './pathfinding.js'

const WIDTH = 960
const HEIGHT = 600
const BORDER = 48

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

function clearOf(rectangle, position, padding = 28) {
  return position.x < rectangle.x - padding || position.x > rectangle.x + rectangle.width + padding || position.y < rectangle.y - padding || position.y > rectangle.y + rectangle.height + padding
}

function buildCandidate(seed, floor, attempt) {
  const random = mulberry32((seed + attempt * 0x9e3779b9) >>> 0)
  const vertical = random() < 0.5
  const riverThickness = integer(random, 74, 112)
  const bridgeSpan = riverThickness + 48
  const bridgeThickness = pick(random, [40, 48, 56])
  const water = []
  const bridges = []
  const stairs = []
  const doors = []
  const spawnPoints = []
  let spawn
  let exit

  if (vertical) {
    const riverX = integer(random, 380, 500)
    water.push(rect(riverX, BORDER, riverThickness, HEIGHT - BORDER * 2, 'water', { role: 'river' }))
    const bridgeY = integer(random, 190, 360)
    const bridge = rect(riverX - 24, bridgeY, bridgeSpan, bridgeThickness, 'bridge', { orientation: 'horizontal' })
    bridges.push(bridge)
    stairs.push(point(bridge.x - 12, bridge.y + bridge.height / 2, { orientation: 'right' }))
    stairs.push(point(bridge.x + bridge.width + 12, bridge.y + bridge.height / 2, { orientation: 'left' }))
    spawn = point(BORDER + 64, integer(random, 118, HEIGHT - 118))
    exit = point(WIDTH - BORDER - 64, integer(random, 118, HEIGHT - 118))
    doors.push(point(BORDER + 10, spawn.y, { side: 'left', role: 'entrance' }))
    doors.push(point(WIDTH - BORDER - 10, exit.y, { side: 'right', role: 'exit' }))
    spawnPoints.push(spawn, exit, point(150, 110), point(150, 490), point(810, 110), point(810, 490))
  } else {
    const riverY = integer(random, 220, 330)
    water.push(rect(BORDER, riverY, WIDTH - BORDER * 2, riverThickness, 'water', { role: 'river' }))
    const bridgeX = integer(random, 340, 570)
    const bridge = rect(bridgeX, riverY - 24, bridgeThickness, bridgeSpan, 'bridge', { orientation: 'vertical' })
    bridges.push(bridge)
    stairs.push(point(bridge.x + bridge.width / 2, bridge.y - 12, { orientation: 'down' }))
    stairs.push(point(bridge.x + bridge.width / 2, bridge.y + bridge.height + 12, { orientation: 'up' }))
    spawn = point(integer(random, 130, WIDTH - 130), BORDER + 64)
    exit = point(integer(random, 130, WIDTH - 130), HEIGHT - BORDER - 64)
    doors.push(point(spawn.x, BORDER + 10, { side: 'top', role: 'entrance' }))
    doors.push(point(exit.x, HEIGHT - BORDER - 10, { side: 'bottom', role: 'exit' }))
    spawnPoints.push(spawn, exit, point(120, 130), point(840, 130), point(120, 470), point(840, 470))
  }

  if (random() < 0.58) {
    const poolWidth = integer(random, 110, 170)
    const poolHeight = integer(random, 72, 118)
    const pool = rect(
      integer(random, BORDER + 70, WIDTH - BORDER - poolWidth - 70),
      integer(random, BORDER + 70, HEIGHT - BORDER - poolHeight - 70),
      poolWidth,
      poolHeight,
      'water',
      { role: 'pool' },
    )
    if ([spawn, exit, ...bridges.map((b) => point(b.x + b.width / 2, b.y + b.height / 2))].every((anchor) => clearOf(pool, anchor, 42))) water.push(pool)
  }

  const solids = boundaries()
  const bridgeCenters = bridges.map((bridge) => point(bridge.x + bridge.width / 2, bridge.y + bridge.height / 2))
  const protectedAnchors = [spawn, exit, ...bridgeCenters]
  const pillarCandidates = [
    point(210, 160), point(750, 160), point(210, 440), point(750, 440),
    point(330, 210), point(630, 390), point(330, 390), point(630, 210),
  ]
  for (const candidate of pillarCandidates) {
    if (random() > 0.56) continue
    const solid = rect(candidate.x - 22, candidate.y - 22, 44, 44, 'pillar')
    if (protectedAnchors.every((anchor) => clearOf(solid, anchor, 52)) && water.every((area) => clearOf(area, candidate, 12))) solids.push(solid)
  }

  const chests = [vertical
    ? point(exit.x - 100, Math.max(100, Math.min(500, exit.y + (random() < 0.5 ? -86 : 86))))
    : point(Math.max(100, Math.min(860, exit.x + (random() < 0.5 ? -110 : 110))), exit.y - 90)]

  const decorationKinds = ['coffin', 'object', 'statue', 'arches', 'plate']
  const decorations = []
  for (let index = 0; index < 12; index++) {
    const candidate = point(integer(random, 100, 860), integer(random, 100, 500), { kind: pick(random, decorationKinds) })
    if ([spawn, exit, ...chests, ...bridgeCenters].some((anchor) => Math.hypot(anchor.x - candidate.x, anchor.y - candidate.y) < 82)) continue
    if (water.some((area) => !clearOf(area, candidate, 8))) continue
    decorations.push(candidate)
    if (decorations.length >= 7) break
  }

  const traps = []
  for (let index = 0; index < 8; index++) {
    const candidate = point(integer(random, 140, 820), integer(random, 130, 470), { kind: random() < 0.52 ? 'spikes' : 'plate-trap' })
    if ([spawn, exit, ...bridgeCenters].some((anchor) => Math.hypot(anchor.x - candidate.x, anchor.y - candidate.y) < 74)) continue
    if (water.some((area) => !clearOf(area, candidate, 4))) continue
    traps.push(candidate)
    if (traps.length >= 4) break
  }

  const torches = [
    point(100, 86), point(860, 86), point(100, 514), point(860, 514),
    ...stairs.slice(0, 2).map((entry, index) => point(entry.x + (index ? 22 : -22), entry.y - 24)),
  ]

  const geometry = {
    name: 'procedural-river', seed, floor, width: WIDTH, height: HEIGHT,
    bounds: { x: BORDER, y: BORDER, width: WIDTH - BORDER * 2, height: HEIGHT - BORDER * 2 },
    solids, water, bridges, stairs, doors, traps, decorations, torches, chests, spawnPoints,
    spawn, exit,
    criticalPath: [spawn, ...bridgeCenters, exit],
  }
  return geometry
}

function validCandidate(geometry) {
  const start = geometry.spawnPoints[0]
  if (!hasRoute(geometry, start, geometry.exit, { cellSize: 32, actorRadius: 14 })) return false
  for (const chest of geometry.chests) if (!hasRoute(geometry, start, chest, { cellSize: 32, actorRadius: 14 })) return false
  for (const bridge of geometry.bridges) {
    const horizontal = bridge.width >= bridge.height
    const a = horizontal ? point(bridge.x - 20, bridge.y + bridge.height / 2) : point(bridge.x + bridge.width / 2, bridge.y - 20)
    const b = horizontal ? point(bridge.x + bridge.width + 20, bridge.y + bridge.height / 2) : point(bridge.x + bridge.width / 2, bridge.y + bridge.height + 20)
    if (!hasRoute(geometry, a, b, { cellSize: 32, actorRadius: 12 })) return false
  }
  return true
}

function safeFallback(seed, floor) {
  const river = rect(440, BORDER, 80, HEIGHT - BORDER * 2, 'water', { role: 'river' })
  const bridge = rect(416, 276, 128, 48, 'bridge', { orientation: 'horizontal' })
  const spawn = point(112, 300)
  const exit = point(848, 300)
  return {
    name: 'procedural-safe', seed, floor, width: WIDTH, height: HEIGHT,
    bounds: { x: BORDER, y: BORDER, width: WIDTH - BORDER * 2, height: HEIGHT - BORDER * 2 },
    solids: boundaries(), water: [river], bridges: [bridge],
    stairs: [point(398, 300, { orientation: 'right' }), point(562, 300, { orientation: 'left' })],
    doors: [point(58, 300, { side: 'left', role: 'entrance' }), point(902, 300, { side: 'right', role: 'exit' })],
    traps: [], decorations: [point(250, 160, { kind: 'statue' }), point(710, 440, { kind: 'coffin' })],
    torches: [point(120, 100), point(840, 100), point(120, 500), point(840, 500)],
    chests: [point(760, 220)], spawnPoints: [spawn, exit, point(150, 120), point(150, 480), point(810, 120), point(810, 480)],
    spawn, exit, criticalPath: [spawn, point(480, 300), exit],
  }
}

export function generateDungeonGeometry({ runSeed = 1, floor = 1 } = {}) {
  const seed = floorSeed(runSeed, floor)
  for (let attempt = 0; attempt < 24; attempt++) {
    const candidate = buildCandidate(seed, floor, attempt)
    if (validCandidate(candidate)) return candidate
  }
  return safeFallback(seed, floor)
}

export { floorSeed }
