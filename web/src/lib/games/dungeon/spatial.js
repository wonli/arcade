const WIDTH = 960
const HEIGHT = 600
const BORDER = 48
const BEAM_PADDING = 18

const rect = (x, y, width, height, kind = 'wall') => ({ x, y, width, height, kind })
const point = (x, y) => ({ x, y })

export const ROOM_TEMPLATES = ['open-hall', 'cross-hall', 'broken-ruins', 'twin-pools', 'pillar-maze', 'narrow-bridge']

export function roomTemplateForFloor(floor = 1) {
  const index = (Math.max(1, Math.floor(floor || 1)) - 1) % ROOM_TEMPLATES.length
  return ROOM_TEMPLATES[index]
}

function boundarySolids() {
  return [
    rect(0, 0, WIDTH, BORDER, 'boundary'),
    rect(0, HEIGHT - BORDER, WIDTH, BORDER, 'boundary'),
    rect(0, BORDER, BORDER, HEIGHT - BORDER * 2, 'boundary'),
    rect(WIDTH - BORDER, BORDER, BORDER, HEIGHT - BORDER * 2, 'boundary'),
  ]
}

const TEMPLATES = {
  'open-hall': {
    solids: [rect(126, 126, 42, 42, 'pillar'), rect(792, 126, 42, 42, 'pillar'), rect(126, 432, 42, 42, 'pillar'), rect(792, 432, 42, 42, 'pillar')],
    water: [],
    torches: [point(96, 76), point(864, 76), point(96, 524), point(864, 524)],
    chests: [point(480, 116)],
    spawnPoints: [point(96, 112), point(864, 112), point(100, 488), point(860, 488), point(480, 92), point(480, 508)],
  },
  'cross-hall': {
    solids: [rect(350, 122, 260, 24, 'broken-wall'), rect(350, 454, 260, 24, 'broken-wall'), rect(218, 222, 24, 156, 'broken-wall'), rect(718, 222, 24, 156, 'broken-wall'), rect(338, 279, 42, 42, 'pillar'), rect(580, 279, 42, 42, 'pillar')],
    water: [],
    torches: [point(305, 92), point(655, 92), point(305, 508), point(655, 508)],
    chests: [point(480, 300)],
    spawnPoints: [point(102, 100), point(858, 100), point(102, 500), point(858, 500), point(480, 82), point(480, 518)],
  },
  'broken-ruins': {
    solids: [rect(204, 176, 176, 24, 'broken-wall'), rect(584, 392, 190, 24, 'broken-wall'), rect(424, 126, 42, 42, 'pillar'), rect(714, 176, 42, 42, 'pillar'), rect(174, 398, 42, 42, 'pillar')],
    water: [rect(390, 288, 180, 88, 'water')],
    torches: [point(104, 88), point(846, 126), point(142, 500), point(808, 504)],
    chests: [point(750, 310)],
    spawnPoints: [point(98, 112), point(858, 122), point(110, 486), point(850, 486), point(480, 90), point(480, 510)],
  },
  'twin-pools': {
    solids: [rect(455, 120, 50, 118, 'pillar-wall'), rect(455, 362, 50, 118, 'pillar-wall')],
    water: [rect(150, 190, 250, 210, 'water'), rect(560, 190, 250, 210, 'water')],
    torches: [point(94, 94), point(866, 94), point(94, 506), point(866, 506)],
    chests: [point(480, 300)],
    spawnPoints: [point(110, 110), point(850, 110), point(110, 490), point(850, 490), point(480, 84), point(480, 516)],
  },
  'pillar-maze': {
    solids: [rect(198, 152, 44, 44, 'pillar'), rect(358, 152, 44, 44, 'pillar'), rect(558, 152, 44, 44, 'pillar'), rect(718, 152, 44, 44, 'pillar'), rect(278, 278, 44, 44, 'pillar'), rect(678, 278, 44, 44, 'pillar'), rect(198, 404, 44, 44, 'pillar'), rect(358, 404, 44, 44, 'pillar'), rect(558, 404, 44, 44, 'pillar'), rect(718, 404, 44, 44, 'pillar')],
    water: [],
    torches: [point(94, 92), point(866, 92), point(94, 508), point(866, 508)],
    chests: [point(480, 474)],
    spawnPoints: [point(100, 110), point(860, 110), point(100, 490), point(860, 490), point(480, 92), point(480, 508)],
  },
  'narrow-bridge': {
    solids: [rect(48, 176, 320, 28, 'wall'), rect(592, 176, 320, 28, 'wall'), rect(48, 396, 320, 28, 'wall'), rect(592, 396, 320, 28, 'wall')],
    water: [rect(48, 204, 320, 192, 'water'), rect(592, 204, 320, 192, 'water')],
    torches: [point(410, 166), point(550, 166), point(410, 434), point(550, 434)],
    chests: [point(480, 104)],
    spawnPoints: [point(100, 110), point(860, 110), point(100, 490), point(860, 490), point(480, 100), point(480, 500)],
  },
}

export function roomGeometry(template = null, floor = 1, _random = Math.random) {
  const name = typeof template === 'string' && TEMPLATES[template] ? template : roomTemplateForFloor(floor)
  const authored = TEMPLATES[name]
  return {
    name,
    width: WIDTH,
    height: HEIGHT,
    bounds: { x: BORDER, y: BORDER, width: WIDTH - BORDER * 2, height: HEIGHT - BORDER * 2 },
    solids: [...boundarySolids(), ...authored.solids.map((entry) => ({ ...entry }))],
    water: authored.water.map((entry) => ({ ...entry })),
    torches: authored.torches.map((entry) => ({ ...entry })),
    chests: authored.chests.map((entry) => ({ ...entry })),
    spawnPoints: authored.spawnPoints.map((entry) => ({ ...entry })),
  }
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value))
}

function circleRectIntersects(position, radius, area) {
  const nearestX = clamp(position.x, area.x, area.x + area.width)
  const nearestY = clamp(position.y, area.y, area.y + area.height)
  const dx = position.x - nearestX
  const dy = position.y - nearestY
  return dx * dx + dy * dy < radius * radius
}

export function circleHitsSolid(position, radius, geometry) {
  return (geometry?.solids ?? []).some((solid) => circleRectIntersects(position, radius, solid))
}

export function movementWithCollision(from, delta, radius, geometry) {
  const dx = delta?.x ?? 0
  const dy = delta?.y ?? 0
  const maxDistance = Math.max(Math.abs(dx), Math.abs(dy))
  const maxStep = Math.max(4, Math.min(10, Math.max(1, radius) * 0.5))
  const steps = Math.max(1, Math.ceil(maxDistance / maxStep))
  const stepX = dx / steps
  const stepY = dy / steps
  const next = { x: from.x, y: from.y }

  for (let index = 0; index < steps; index++) {
    const candidateX = { x: next.x + stepX, y: next.y }
    if (!circleHitsSolid(candidateX, radius, geometry)) next.x = candidateX.x
    const candidateY = { x: next.x, y: next.y + stepY }
    if (!circleHitsSolid(candidateY, radius, geometry)) next.y = candidateY.y
  }
  return next
}

export function terrainAt(position, geometry) {
  const water = (geometry?.water ?? []).some((area) => position.x >= area.x && position.x <= area.x + area.width && position.y >= area.y && position.y <= area.y + area.height)
  return water
    ? { type: 'water', speedMultiplier: 0.62, navCost: 2.4 }
    : { type: 'floor', speedMultiplier: 1, navCost: 1 }
}

function segmentRectIntersection(start, end, area, padding = 0) {
  const minX = area.x - padding
  const maxX = area.x + area.width + padding
  const minY = area.y - padding
  const maxY = area.y + area.height + padding
  const dx = end.x - start.x
  const dy = end.y - start.y
  let tMin = 0
  let tMax = 1

  for (const [origin, direction, min, max] of [[start.x, dx, minX, maxX], [start.y, dy, minY, maxY]]) {
    if (Math.abs(direction) < 1e-9) {
      if (origin < min || origin > max) return null
      continue
    }
    const t1 = (min - origin) / direction
    const t2 = (max - origin) / direction
    const near = Math.min(t1, t2)
    const far = Math.max(t1, t2)
    tMin = Math.max(tMin, near)
    tMax = Math.min(tMax, far)
    if (tMin > tMax) return null
  }
  return tMin >= 0 && tMin <= 1 ? tMin : null
}

export function clipSegmentToSolids(start, end, geometry, padding = BEAM_PADDING) {
  let bestT = 1
  for (const solid of geometry?.solids ?? []) {
    const t = segmentRectIntersection(start, end, solid, padding)
    if (t !== null && t < bestT) bestT = t
  }
  return {
    x: start.x + (end.x - start.x) * bestT,
    y: start.y + (end.y - start.y) * bestT,
    blocked: bestT < 1,
  }
}
