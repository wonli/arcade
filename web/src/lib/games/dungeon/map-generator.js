import { dressThemedRooms, populateWater } from './dungeon3-dressing.js'
import { buildNavGrid, findPath } from './pathfinding.js'
import { circleHitsSolid } from './spatial.js'
import { dungeon3Rules } from './dungeon3-rules.js'

const TILE = 16
const WIDTH = 960
const HEIGHT = 600
const COLS = WIDTH / TILE
const ROWS = Math.floor(HEIGHT / TILE)
// Validate the largest grounded actor, including the navigation-cell margin.
const RADIUS = 26
const SLOT_COLUMNS = [176, 480, 784]
const SLOT_ROWS = [144, 304, 464]
const CORRIDOR = 96
const rect = (x, y, width, height, kind, extra = {}) => ({ x, y, width, height, kind, ...extra })
const point = (x, y) => ({ x, y })

function hashSeed(value) {
  let hash = 2166136261 >>> 0
  for (const character of String(value ?? 'dungeon')) hash = Math.imul(hash ^ character.charCodeAt(0), 16777619)
  return hash >>> 0
}
export function floorSeed(runSeed, floor) { return hashSeed(`${runSeed}:${Math.max(1, Math.floor(floor || 1))}`) }
function rng(seed) {
  let state = seed >>> 0
  return () => {
    state += 0x6D2B79F5
    let t = Math.imul(state ^ state >>> 15, state | 1)
    t ^= t + Math.imul(t ^ t >>> 7, t | 61)
    return ((t ^ t >>> 14) >>> 0) / 4294967296
  }
}
const pick = (random, values) => values[Math.floor(random() * values.length)]
function shuffle(random, values) {
  const result = [...values]
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1))
    ;[result[i], result[j]] = [result[j], result[i]]
  }
  return result
}
function overlaps(a, b, padding = 0) {
  return a.x < b.x + b.width + padding && a.x + a.width > b.x - padding && a.y < b.y + b.height + padding && a.y + a.height > b.y - padding
}
function inside(p, r, padding = 0) {
  return p.x >= r.x + padding && p.x <= r.x + r.width - padding && p.y >= r.y + padding && p.y <= r.y + r.height - padding
}
function slotKey(row, column) { return `${row}:${column}` }
function slotNeighbors(slot) {
  return [[-1, 0], [1, 0], [0, -1], [0, 1]]
    .map(([dr, dc]) => ({ row: slot.row + dr, column: slot.column + dc }))
    .filter(({ row, column }) => row >= 0 && row < SLOT_ROWS.length && column >= 0 && column < SLOT_COLUMNS.length)
}
function weightedRoomCount(random) {
  const roll = random()
  if (roll < 0.05) return 4
  if (roll < 0.20) return 5
  if (roll < 0.45) return 6
  if (roll < 0.70) return 7
  if (roll < 0.90) return 8
  return 9
}
function growRoomGraph(random, targetCount) {
  const column = Math.floor(random() * 3)
  const slots = [0, 1, 2].map(row => ({ row, column }))
  const occupied = new Map(slots.map((slot, id) => [slotKey(slot.row, slot.column), id]))
  const edges = [[0, 1], [1, 2]]
  while (slots.length < targetCount) {
    const frontier = []
    for (let parent = 0; parent < slots.length; parent++) {
      for (const candidate of slotNeighbors(slots[parent])) {
        if (!occupied.has(slotKey(candidate.row, candidate.column))) frontier.push({ ...candidate, parent })
      }
    }
    const next = pick(random, frontier)
    const id = slots.length
    slots.push({ row: next.row, column: next.column })
    occupied.set(slotKey(next.row, next.column), id)
    edges.push([next.parent, id])
  }
  const existing = new Set(edges.map(([a, b]) => a < b ? `${a}:${b}` : `${b}:${a}`))
  const extras = []
  for (let a = 0; a < slots.length; a++) {
    for (const neighbor of slotNeighbors(slots[a])) {
      const b = occupied.get(slotKey(neighbor.row, neighbor.column))
      if (b == null || b <= a) continue
      const key = `${a}:${b}`
      if (existing.has(key) || random() >= 0.34) continue
      existing.add(key)
      extras.push([a, b])
    }
  }
  return { slots, edges: [...edges, ...extras] }
}
function graphInfo(roomCount, edges, start) {
  const adjacency = Array.from({ length: roomCount }, () => [])
  for (const [a, b] of edges) { adjacency[a].push(b); adjacency[b].push(a) }
  const distances = Array(roomCount).fill(Infinity), parents = Array(roomCount).fill(-1), queue = [start]
  distances[start] = 0
  for (const room of queue) {
    for (const next of adjacency[room]) {
      if (Number.isFinite(distances[next])) continue
      distances[next] = distances[room] + 1
      parents[next] = room
      queue.push(next)
    }
  }
  return { adjacency, distances, parents }
}
function routeTo(parents, finish) {
  const route = []
  for (let current = finish; current >= 0; current = parents[current]) route.push(current)
  return route.reverse()
}

// Merge equal row spans vertically without filling holes or changing tile occupancy.
function rectanglesFor(grid, kind) {
  const out = [], previous = new Map()
  for (let y = 0; y < ROWS; y++) {
    const next = new Map()
    for (let x = 0; x < COLS;) {
      if (grid[y * COLS + x].kind !== kind) { x++; continue }
      const start = x
      while (x < COLS && grid[y * COLS + x].kind === kind) x++
      const key = `${start}:${x}`
      let area = previous.get(key)
      if (area) area.height += TILE
      else { area = rect(start * TILE, y * TILE, (x - start) * TILE, TILE, kind); out.push(area) }
      next.set(key, area)
    }
    previous.clear()
    for (const [key, area] of next) previous.set(key, area)
  }
  return out
}

function decorationCandidates(random, room, width, height) {
  const candidates = []
  const minX = room.x + TILE, maxX = room.x + room.width - width - TILE
  const minY = room.y + TILE, maxY = room.y + room.height - height - TILE
  for (let y = minY; y <= maxY; y += TILE) for (let x = minX; x <= maxX; x += TILE) {
    const edgeDistance = Math.min(x - room.x, room.x + room.width - (x + width), y - room.y, room.y + room.height - (y + height))
    if (edgeDistance <= TILE * 2) candidates.push(point(x, y))
  }
  return shuffle(random, candidates)
}
function decorationScale(motif) {
  const area = motif.width * motif.height
  if (area >= 12) return 'large'
  if (area >= 4) return 'medium'
  return 'small'
}

function build(seed, floor, attempt) {
  const random = rng(seed + Math.imul(attempt, 0x9e3779b9))
  const cells = Array.from({ length: COLS * ROWS }, (_, i) => {
    const x = i % COLS, y = Math.floor(i / COLS)
    return { kind: x < 3 || x >= 57 || y < 3 || y >= 34 ? 'boundary' : 'water', level: 0 }
  })
  const targetCount = weightedRoomCount(random)
  const topology = growRoomGraph(random, targetCount)
  const themes = shuffle(random, ['shrine', 'crypt', 'gauntlet', 'flooded', ...Array.from({ length: Math.max(0, targetCount - 4) }, (_, i) => i % 2 ? 'crypt' : 'gallery')])
  const rooms = topology.slots.map((slot, id) => {
    const cx = SLOT_COLUMNS[slot.column], cy = SLOT_ROWS[slot.row]
    const theme = themes[id]
    const width = theme === 'flooded' ? 224 : 256, height = 160
    return rect(cx - width / 2, cy - height / 2, width, height, 'room', {
      id, theme, level: 2 - slot.row, center: point(cx, cy), slot: { ...slot },
    })
  })
  const carve = (area, kind, level, onlyWater = false) => {
    for (let y = area.y / TILE; y < (area.y + area.height) / TILE; y++) {
      for (let x = area.x / TILE; x < (area.x + area.width) / TILE; x++) {
        const cell = cells[y * COLS + x]
        if (!cell || cell.kind === 'boundary' || (onlyWater && cell.kind !== 'water')) continue
        cell.kind = kind; cell.level = level
      }
    }
  }
  for (const room of rooms) carve(room, 'floor', room.level)

  const paths = [], bridges = []
  for (const [a, b] of topology.edges) {
    const from = rooms[a].center, to = rooms[b].center
    const horizontal = from.y === to.y, half = CORRIDOR / 2
    const path = horizontal
      ? rect(Math.min(from.x, to.x) - half, from.y - half, Math.abs(to.x - from.x) + half * 2, half * 2, 'path')
      : rect(from.x - half, Math.min(from.y, to.y) - half, CORRIDOR, Math.abs(to.y - from.y) + CORRIDOR, 'path')
    path.id = paths.length; path.from = a; path.to = b; path.level = Math.min(rooms[a].level, rooms[b].level)
    paths.push(path)
    const lower = horizontal ? (from.x < to.x ? rooms[a] : rooms[b]) : (from.y < to.y ? rooms[a] : rooms[b])
    const upper = lower === rooms[a] ? rooms[b] : rooms[a]
    const bridge = horizontal
      ? rect(lower.x + lower.width - TILE, from.y - half, Math.max(TILE * 2, upper.x - lower.x - lower.width + TILE * 2), half * 2, 'bridge', { orientation: 'horizontal' })
      : rect(from.x - half, lower.y + lower.height - TILE, CORRIDOR, Math.max(TILE * 2, upper.y - lower.y - lower.height + TILE * 2), 'bridge', { orientation: 'vertical' })
    bridge.pathId = path.id; bridge.level = path.level
    bridges.push(bridge)
    carve(path, 'bridge', path.level, true)
  }

  for (const room of rooms.filter(r => r.theme === 'flooded')) {
    room.inlets = [rect(room.x, room.y + room.height - 32, 32, 32, 'inlet'),
      rect(room.x + room.width - 48, room.y + room.height - 32, 48, 32, 'inlet')]
    for (const inlet of room.inlets) carve(inlet, 'water', 0)
  }

  const g = {
    name: 'dungeon3-grid', seed, floor, width: WIDTH, height: HEIGHT,
    bounds: { x: 48, y: 48, width: 864, height: 496 },
    grid: { tileSize: TILE, columns: COLS, rows: ROWS, cells }, rooms, paths, bridges,
    water: rectanglesFor(cells, 'water'),
    solids: [...rectanglesFor(cells, 'boundary'), rect(0, ROWS * TILE, WIDTH, HEIGHT - ROWS * TILE, 'boundary')],
    waterFeatures: [], pavingAreas: [], walls: [], elevations: [], stairs: [], doors: [], traps: [], decorations: [], torches: [], chests: [], spawnPoints: [], criticalPath: [],
  }

  const degrees = topology.slots.map((_, id) => topology.edges.reduce((count, [a, b]) => count + (a === id || b === id ? 1 : 0), 0))
  const leaves = degrees.map((degree, id) => ({ degree, id })).filter(entry => entry.degree === 1).map(entry => entry.id)
  const start = pick(random, leaves.length ? leaves : rooms.map(room => room.id))
  const info = graphInfo(rooms.length, topology.edges, start)
  const maxDistance = Math.max(...info.distances)
  const finish = pick(random, info.distances.map((distance, id) => ({ distance, id })).filter(entry => entry.distance === maxDistance).map(entry => entry.id))
  const criticalRooms = routeTo(info.parents, finish)
  const restRoom = criticalRooms[Math.max(0, Math.min(criticalRooms.length - 1, Math.floor(criticalRooms.length / 2)))]
  const sideLeaves = leaves.filter(id => id !== start && id !== finish)
  const chestRoom = sideLeaves.length ? pick(random, sideLeaves) : info.distances
    .map((distance, id) => ({ distance, id })).filter(entry => entry.id !== start && entry.id !== finish)
    .sort((a, b) => b.distance - a.distance)[0]?.id ?? restRoom
  const anchor = room => ({ ...room.center })
  g.spawn = anchor(rooms[start]); g.exit = anchor(rooms[finish]); g.rest = { ...rooms[restRoom].center }
  g.spawnPoints = rooms.map(room => ({ ...room.center }))
  g.chests = [{ ...rooms[chestRoom].center }]

  // A floor is a physical terrace: upper rows descend south by one level.
  // Same-level spans are bridges; only elevation changes receive stairs.
  for (const path of paths) {
    const a = rooms[path.from], b = rooms[path.to]
    if (a.level === b.level) continue
    const high = a.level > b.level ? a : b, low = high === a ? b : a
    const stair = {
      x: high.center.x, y: high.y + high.height - TILE / 2,
      width: 96, height: 48, orientation: 'down', pathId: path.id,
      highLevel: high.level, lowLevel: low.level,
    }
    g.stairs.push(stair)
    // Reserve the transition in the navigation model. Its lip is the only
    // opening in this terrace face; no sideways access through a vertical drop.
    const left = stair.x - 48, edgeY = high.y + high.height - TILE
    for (const [x, width] of [[high.x, left - high.x], [stair.x + 48, high.x + high.width - stair.x - 48]]) {
      if (width > 0) g.solids.push(rect(x, edgeY, width, TILE, 'elevation'))
    }
    g.elevations.push({ roomId: high.id, x: high.x, y: edgeY, width: high.width, height: 32, opening: { x: left, width: 96 }, highLevel: high.level, lowLevel: low.level })
    for (let y = (stair.y - 24) / TILE; y < (stair.y + 24) / TILE; y++) {
      for (let x = (stair.x - 48) / TILE; x < (stair.x + 48) / TILE; x++) {
        const cell = cells[y * COLS + x]
        if (cell) cell.transition = { high: high.level, low: low.level, pathId: path.id }
      }
    }
  }

  const protectedAnchors = [g.spawn, g.exit, g.rest, ...g.chests, ...g.spawnPoints]
  const safeHazard = area => !protectedAnchors.some(p => overlaps(area, rect(p.x - 24, p.y - 24, 48, 48, 'safe')))
  for (const room of rooms) {
    const northConnection = paths.some(p => {
      const other = p.from === room.id ? rooms[p.to] : p.to === room.id ? rooms[p.from] : null
      return other && other.center.x === room.center.x && other.center.y < room.center.y
    })
    // North-facing wall sections flank a real entrance, or enclose a room.
    // Doors are closed alcoves in these walls, as in Walls2; they are never
    // floating objects at east/west bridge ends or looping opening animations.
    const wall = { id: `wall-${room.id}`, roomId: room.id, x: room.x, y: room.y - TILE, width: room.width, height: 48,
      opening: northConnection ? { x: room.center.x - 48, width: 96 } : null }
    g.walls.push(wall)
    for (let x = room.x; x < room.x + room.width; x += TILE) {
      if (wall.opening && x >= wall.opening.x && x < wall.opening.x + wall.opening.width) continue
      g.solids.push(rect(x, room.y + TILE, TILE, TILE, 'wall'))
    }
    if (!northConnection) g.doors.push({ x: room.center.x, y: room.y + 8, wallId: wall.id, orientation: 'down', role: 'alcove', motif: dungeon3Rules.assemblies.door, static: true })
    const wallTrap = dungeon3Rules.assemblies.wallTrap
    const trapX = room.x + TILE * 2, trapY = wall.y
    const damageArea = rect(trapX, trapY + 32, 32, 64, 'hazard')
    if (['gallery', 'flooded'].includes(room.theme) && safeHazard(damageArea)) g.traps.push({ id: `wall-trap-${room.id}`, roomId: room.id, wallId: wall.id, kind: 'wall-trap', x: trapX + 16, y: trapY + 48, motif: wallTrap, damageArea, orientation: 'down' })
    const plateX = room.x + room.width - 48, plateY = room.y + room.height - 48
    const plateArea = rect(plateX, plateY, 32, 32, 'hazard')
    if (room.theme !== 'crypt' && safeHazard(plateArea)) g.traps.push({ id: `floor-trap-${room.id}`, roomId: room.id, kind: 'plate-trap', x: plateX + 16, y: plateY + 16, motif: dungeon3Rules.assemblies.floorTrap, damageArea: plateArea })
  }

  dressThemedRooms(g, random)
  populateWater(g, random)

  const reserved = [g.spawn, g.exit, g.rest, ...g.chests, ...g.spawnPoints, ...g.doors]
  const motifs = [
    ...dungeon3Rules.motifs.coffins.map(motif => ({ kind: 'coffin', motif })),
    ...dungeon3Rules.motifs.otherObjects.map(motif => ({ kind: 'object', motif })),
  ].filter(entry => entry.motif.width <= 6 && entry.motif.height <= 6)
  const byScale = {
    large: motifs.filter(entry => decorationScale(entry.motif) === 'large'),
    medium: motifs.filter(entry => decorationScale(entry.motif) === 'medium'),
    small: motifs.filter(entry => decorationScale(entry.motif) === 'small'),
  }
  const decorationArea = d => rect(d.x - d.footprint.width / 2, d.y - d.footprint.height / 2, d.footprint.width, d.footprint.height, 'prop')
  const placeDecoration = (room, pool, blocking = true, preferLargest = false) => {
    if (!pool.length) return false
    const entries = shuffle(random, pool)
    if (preferLargest) entries.sort((a, b) => b.motif.width * b.motif.height - a.motif.width * a.motif.height)
    for (const entry of entries) {
      const width = entry.motif.width * TILE, height = entry.motif.height * TILE
      const scale = decorationScale(entry.motif)
      let collisionArea = null
      const area = decorationCandidates(random, room, width, height).map(p => rect(p.x, p.y, width, height, 'decoration')).find(candidate => {
        const collisionWidth = scale === 'large' ? Math.min(width, TILE * 2) : width
        const collisionHeight = scale === 'large' ? Math.min(height, TILE) : height
        const collision = rect(candidate.x + (width - collisionWidth) / 2, candidate.y + height - collisionHeight, collisionWidth, collisionHeight, 'prop')
        const valid = inside(point(candidate.x, candidate.y), room, TILE) && inside(point(candidate.x + width, candidate.y + height), room, TILE) &&
          (!blocking || !paths.some(path => overlaps(collision, path))) &&
          Array.from({ length: width / TILE * (height / TILE) }, (_, i) => cells[(candidate.y / TILE + Math.floor(i / (width / TILE))) * COLS + candidate.x / TILE + i % (width / TILE)]).every(c => c?.kind === 'floor') &&
          !g.solids.some(s => overlaps(candidate, s)) &&
          !g.traps.some(t => overlaps(candidate, t.damageArea, 4)) &&
          !reserved.some(p => overlaps(candidate, rect(p.x - 36, p.y - 36, 72, 72, 'reserved'), 4)) &&
          !g.decorations.some(d => d.footprint && overlaps(candidate, decorationArea(d), 4))
        if (valid) collisionArea = collision
        return valid
      })
      if (!area) continue
      const collisionFootprint = collisionArea ? { width: collisionArea.width, height: collisionArea.height } : { width, height }
      g.decorations.push({ x: area.x + width / 2, y: area.y + height / 2, kind: entry.kind, motif: entry.motif, scale, footprint: { width, height }, collisionFootprint, blocking })
      if (blocking) g.solids.push({ ...collisionArea, kind: 'prop', authored: true })
      return true
    }
    return false
  }
  for (const room of rooms) {
    placeDecoration(room, byScale.large.length ? byScale.large : motifs, true, true)
    if (random() < 0.4) placeDecoration(room, byScale.large.length ? byScale.large : motifs, true, true)
    const mediumCount = 2 + Math.floor(random() * 2)
    for (let i = 0; i < mediumCount; i++) placeDecoration(room, byScale.medium.length ? byScale.medium : motifs, i === 0)
    const smallCount = 5 + Math.floor(random() * 4)
    for (let i = 0; i < smallCount; i++) placeDecoration(room, byScale.small.length ? byScale.small : motifs, false)
    g.torches.push(point(room.center.x, room.y + TILE * 2))
  }

  return g
}

function validate(g) {
  const anchors = [g.spawn, g.exit, g.rest, ...g.spawnPoints, ...g.chests]
  if (anchors.some(p => circleHitsSolid(p, RADIUS, g))) return false
  const grid = buildNavGrid(g, { cellSize: TILE, actorRadius: RADIUS })
  for (const target of anchors.slice(1)) {
    const path = findPath(grid, g.spawn, target)
    if (!path.length) return false
    if (target === g.exit) g.criticalPath = [g.spawn, ...path.map(({ x, y }) => ({ x, y })), g.exit]
  }
  return true
}

export function generateDungeonGeometry({ runSeed = 1, floor = 1 } = {}) {
  floor = Math.max(1, Math.floor(Number(floor) || 1))
  const seed = floorSeed(runSeed, floor)
  for (let attempt = 0; attempt < 12; attempt++) {
    const geometry = build(seed, floor, attempt)
    if (validate(geometry)) return geometry
  }
  const fallback = build(seed, floor, 0)
  fallback.decorations = fallback.decorations.filter(d => d.planned)
  fallback.solids = fallback.solids.filter(s => !s.authored || s.planned)
  if (!validate(fallback)) throw new Error(`Dungeon3 map is disconnected: ${seed}/${floor}`)
  return fallback
}
