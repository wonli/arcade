import { layoutContractViolations, pointInDamageArea } from './dungeon3-layout-validation.js'
import { dressThemedRooms, populateWater, populateRoomHazards } from './dungeon3-dressing.js'
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
const BRIDGE_THROAT = 80
const rect = (x, y, width, height, kind, extra = {}) => ({ x, y, width, height, kind, ...extra })
const point = (x, y) => ({ x, y })
const snapDownToTile = value => Math.floor(value / TILE) * TILE

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
function assignRoomLevels(random, roomCount, edges) {
  for (let attempt = 0; attempt < 64; attempt++) {
    const levels = Array.from({ length: roomCount }, () => Math.floor(random() * 3))
    if (new Set(levels).size < 2) continue
    if (edges.every(([a, b]) => Math.abs(levels[a] - levels[b]) <= 1)) return levels
  }
  const levels = Array(roomCount).fill(1)
  levels[0] = 0
  return levels
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
function connectionDirection(a, b) {
  if (a.center.y === b.center.y) {
    const fromRight = a.center.x < b.center.x
    return { axis: 'horizontal', fromSide: fromRight ? 'east' : 'west', toSide: fromRight ? 'west' : 'east' }
  }
  const fromBottom = a.center.y < b.center.y
  return { axis: 'vertical', fromSide: fromBottom ? 'south' : 'north', toSide: fromBottom ? 'north' : 'south' }
}
function rectHasWater(area, cells) {
  for (let y = area.y / TILE; y < (area.y + area.height) / TILE; y++) {
    for (let x = area.x / TILE; x < (area.x + area.width) / TILE; x++) {
      if (cells[y * COLS + x]?.kind === 'water') return true
    }
  }
  return false
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
  const roomLevels = assignRoomLevels(random, topology.slots.length, topology.edges)
  const themes = shuffle(random, ['shrine', 'crypt', 'gauntlet', 'flooded', ...Array.from({ length: Math.max(0, targetCount - 4) }, (_, i) => i % 2 ? 'crypt' : 'gallery')])
  const rooms = topology.slots.map((slot, id) => {
    const cx = SLOT_COLUMNS[slot.column], cy = SLOT_ROWS[slot.row]
    const theme = themes[id]
    // Keep each slot's outside wall on one grid line. Flooded rooms vary by
    // water/inlet layout, not by shrinking their footprint; a narrower room
    // would move both side walls by one tile and expose the boundary water as
    // broken map-edge walls when rooms in the same column touch.
    const width = 256, height = 160
    return rect(cx - width / 2, cy - height / 2, width, height, 'room', {
      id, theme, level: roomLevels[id], center: point(cx, cy), slot: { ...slot },
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
    const direction = connectionDirection(rooms[a], rooms[b])
    const horizontal = direction.axis === 'horizontal', half = CORRIDOR / 2
    const path = horizontal
      ? rect(Math.min(from.x, to.x) - half, from.y - half, Math.abs(to.x - from.x) + half * 2, half * 2, 'path')
      : rect(from.x - half, Math.min(from.y, to.y) - half, CORRIDOR, Math.abs(to.y - from.y) + CORRIDOR, 'path')
    path.id = paths.length; path.from = a; path.to = b; path.level = Math.min(rooms[a].level, rooms[b].level)
    path.direction = direction
    path.levelDelta = Math.abs(rooms[a].level - rooms[b].level)
    path.crossesWater = rectHasWater(path, cells)
    path.connectionKind = path.levelDelta ? 'stairs' : path.crossesWater ? 'bridge' : random() < 0.68 ? 'door' : 'open'
    paths.push(path)
    const lower = horizontal ? (from.x < to.x ? rooms[a] : rooms[b]) : (from.y < to.y ? rooms[a] : rooms[b])
    const upper = lower === rooms[a] ? rooms[b] : rooms[a]
    const bridge = horizontal
      ? rect(lower.x + lower.width - TILE, snapDownToTile(from.y - BRIDGE_THROAT / 2), Math.max(TILE * 6, upper.x - lower.x - lower.width + TILE * 2), BRIDGE_THROAT, 'bridge', { orientation: 'horizontal' })
      : rect(snapDownToTile(from.x - BRIDGE_THROAT / 2), lower.y + lower.height - TILE, BRIDGE_THROAT, Math.max(TILE * 2, upper.y - lower.y - lower.height + TILE * 2), 'bridge', { orientation: 'vertical' })
    bridge.pathId = path.id; bridge.level = path.level
    bridge.walkable = horizontal
      ? rect(bridge.x, path.y, bridge.width, path.height, 'bridge-clearance')
      : rect(path.x, bridge.y, path.width, bridge.height, 'bridge-clearance')
    const waterGap = horizontal ? upper.x - lower.x - lower.width : upper.y - lower.y - lower.height
    if (path.connectionKind === 'bridge') {
      bridge.variant = Math.floor(random() * 3)
      bridge.structure = random() < 0.45 ? 'arch' : 'flat'
      bridges.push(bridge)
      carve(bridge, 'bridge', path.level, true)
    } else {
      carve(path, 'floor', path.level, true)
    }
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

  // Only level changes receive stairs. Same-level spans are already carved as
  // bridges, doors, or ordinary open paths above.
  for (const path of paths) {
    const a = rooms[path.from], b = rooms[path.to]
    if (path.connectionKind !== 'stairs') continue
    const high = a.level > b.level ? a : b, low = high === a ? b : a
    const horizontal = path.direction.axis === 'horizontal'
    const highBeforeLow = horizontal ? high.center.x < low.center.x : high.center.y < low.center.y
    const orientation = horizontal ? (highBeforeLow ? 'right' : 'left') : (highBeforeLow ? 'down' : 'up')
    const edgeX = horizontal ? (highBeforeLow ? high.x + high.width - TILE : high.x) : high.x
    const edgeY = horizontal ? high.y : (highBeforeLow ? high.y + high.height - TILE : high.y)
    const stair = {
      x: horizontal ? edgeX + (highBeforeLow ? TILE / 2 : -TILE / 2) : high.center.x,
      y: horizontal ? high.center.y : edgeY + (highBeforeLow ? TILE / 2 : -TILE / 2),
      width: horizontal ? 48 : 96, height: horizontal ? 96 : 48, orientation, pathId: path.id,
      highLevel: high.level, lowLevel: low.level,
    }
    g.stairs.push(stair)
    const opening = horizontal
      ? { y: stair.y - 48, height: 96 }
      : { x: stair.x - 48, width: 96 }
    if (horizontal) {
      const barrierX = edgeX
      for (const [y, height] of [[high.y, opening.y - high.y], [opening.y + opening.height, high.y + high.height - opening.y - opening.height]]) {
        if (height > 0) g.solids.push(rect(barrierX, y, TILE, height, 'elevation'))
      }
    } else {
      for (const [x, width] of [[high.x, opening.x - high.x], [opening.x + opening.width, high.x + high.width - opening.x - opening.width]]) {
        if (width > 0) g.solids.push(rect(x, edgeY, width, TILE, 'elevation'))
      }
    }
    g.elevations.push({ roomId: high.id, x: horizontal ? edgeX : high.x, y: horizontal ? high.y : edgeY,
      width: horizontal ? TILE : high.width, height: horizontal ? high.height : TILE, opening: horizontal ? opening : { x: opening.x, width: opening.width },
      highLevel: high.level, lowLevel: low.level, orientation, pathId: path.id })
    for (let y = (stair.y - stair.height / 2) / TILE; y < (stair.y + stair.height / 2) / TILE; y++) {
      for (let x = (stair.x - stair.width / 2) / TILE; x < (stair.x + stair.width / 2) / TILE; x++) {
        const cell = cells[y * COLS + x]
        if (cell) cell.transition = { high: high.level, low: low.level, pathId: path.id }
      }
    }
  }

  const connectionByRoomSide = new Map(rooms.map(room => [room.id, new Map()]))
  for (const path of paths) {
    connectionByRoomSide.get(path.from).set(path.direction.fromSide, path)
    connectionByRoomSide.get(path.to).set(path.direction.toSide, path)
  }
  const wallByRoomSide = new Map()
  const wallSides = ['north', 'east', 'south', 'west']
  // The authored door frame is upright in its native/down orientation. A
  // south-side connection is still approached from below, but must not flip
  // the frame upside down.
  const doorOrientation = { north: 'down', south: 'down', west: 'right', east: 'left' }
  for (const room of rooms) {
    for (const side of wallSides) {
      const horizontal = side === 'north' || side === 'south'
      const path = connectionByRoomSide.get(room.id).get(side) ?? null
      const passage = path ? (horizontal ? { x: room.center.x - 48, width: 96, pathId: path.id } : { y: room.center.y - 48, height: 96, pathId: path.id }) : null
      // A door needs a narrow authored visual opening, while the route still
      // needs a full actor throat. Keeping those spans separate prevents the
      // wall renderer from leaving a large blank hole beside the door.
      const opening = path
        ? path.connectionKind === 'door'
          ? (horizontal ? { x: room.center.x - 16, width: 32, pathId: path.id } : { y: room.center.y - 16, height: 32, pathId: path.id })
          : passage
        : null
      const wall = {
        id: `wall-${room.id}-${side}`, roomId: room.id, side,
        orientation: horizontal ? 'horizontal' : 'vertical',
        x: horizontal ? room.x : side === 'west' ? room.x - TILE : room.x + room.width,
        y: horizontal ? (side === 'north' ? room.y - TILE : room.y + room.height) : room.y,
        width: horizontal ? room.width : TILE,
        height: horizontal ? 48 : room.height,
        opening, passage,
      }
      g.walls.push(wall)
      wallByRoomSide.set(`${room.id}:${side}`, wall)

      const band = horizontal
        ? { x: room.x, y: side === 'north' ? room.y - TILE : room.y + room.height, width: room.width, height: TILE }
        : { x: side === 'west' ? room.x - TILE : room.x + room.width, y: room.y, width: TILE, height: room.height }
      if (!wall.passage) {
        g.solids.push({ ...band, kind: 'wall', wallId: wall.id })
      } else if (horizontal) {
        for (const [x, width] of [[band.x, wall.passage.x - band.x], [wall.passage.x + wall.passage.width, band.x + band.width - wall.passage.x - wall.passage.width]]) {
          if (width > 0) g.solids.push({ ...band, x, width, wallId: wall.id })
        }
      } else {
        for (const [y, height] of [[band.y, wall.passage.y - band.y], [wall.passage.y + wall.passage.height, band.y + band.height - wall.passage.y - wall.passage.height]]) {
          if (height > 0) g.solids.push({ ...band, y, height, wallId: wall.id })
        }
      }
    }
  }

  for (const path of paths.filter(entry => entry.connectionKind === 'door')) {
    const room = rooms[path.from], side = path.direction.fromSide, wall = wallByRoomSide.get(`${room.id}:${side}`)
    if (!wall) continue
    const horizontal = wall.orientation === 'horizontal'
    // The authored door is a complete 2x3 replacement for one horizontal
    // wall segment (room-02), not a sprite centered on the room boundary.
    // Anchor its visual footprint to the wall band; side doors use the
    // one-column wall band's center before the renderer rotates the motif.
    const anchor = horizontal
      ? { x: wall.opening.x + wall.opening.width / 2, y: wall.y + wall.height / 2 }
      : { x: wall.x + wall.width / 2, y: wall.opening.y + wall.opening.height / 2 }
    const door = {
      id: `door-${path.id}`, roomId: room.id, pathId: path.id, wallId: wall.id, side,
      x: anchor.x, y: anchor.y,
      orientation: doorOrientation[side], role: 'gate', opened: false,
      motif: dungeon3Rules.assemblies.door, openMotif: dungeon3Rules.assemblies.doorOpen, static: true,
    }
    door.collision = horizontal
      ? rect(door.x - 48, door.y - TILE / 2, 96, TILE, 'door', { doorId: door.id, pathId: path.id })
      : rect(door.x - TILE / 2, door.y - 48, TILE, 96, 'door', { doorId: door.id, pathId: path.id })
    g.doors.push(door)
    g.solids.push({ ...door.collision })
  }

  dressThemedRooms(g, random)
  // Theme inlets are final before collision rectangles and hazards are built.
  g.water = rectanglesFor(cells, 'water')
  populateRoomHazards(g)
  populateWater(g, random)

  const reserved = [g.spawn, g.exit, g.rest, ...g.chests, ...g.spawnPoints, ...g.doors]
  const keyTileIds = new Set([237, 238])
  const isKeyMotif = motif => motif.cells?.some(cell => keyTileIds.has(cell.tileId))
  const motifs = [
    ...dungeon3Rules.motifs.coffins.map(motif => ({ kind: 'coffin', motif })),
    ...dungeon3Rules.motifs.otherObjects.map(motif => ({ kind: 'object', motif })),
    ...dungeon3Rules.motifs.candles.map(motif => ({ kind: 'candle', motif })),
    ...dungeon3Rules.motifs.reliefs.map(motif => ({ kind: 'relief', motif })),
  ].filter(entry => entry.motif.width <= 6 && entry.motif.height <= 6 && !isKeyMotif(entry.motif))
  const byScale = {
    large: motifs.filter(entry => decorationScale(entry.motif) === 'large'),
    medium: motifs.filter(entry => decorationScale(entry.motif) === 'medium'),
    small: motifs.filter(entry => decorationScale(entry.motif) === 'small'),
  }
  const decorationArea = d => rect(d.x - d.footprint.width / 2, d.y - d.footprint.height / 2, d.footprint.width, d.footprint.height, 'prop')
  const placeDecoration = (room, pool, blocking = true, preferLargest = false) => {
    if (!pool.length) return false
    const entries = shuffle(random, pool)
    const reservedLanes = [room.layout?.safeLane, ...(room.layout?.approachLanes ?? [])].filter(Boolean)
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
          !reservedLanes.some(lane => overlaps(candidate, lane, 4)) &&
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

  // Make the newly recovered authored motifs visible in ordinary runs. Random
  // dressing still supplies variety, but a theme is not considered used just
  // because it happened to be selected by one seed out of many.
  for (const kind of ['candle', 'relief']) {
    if (g.decorations.some(decoration => decoration.kind === kind)) continue
    const pool = motifs.filter(entry => entry.kind === kind)
    for (const room of rooms) {
      if (placeDecoration(room, pool, false, true)) break
    }
  }

  return g
}

function validate(g) {
  if (layoutContractViolations(g).length) return false
  const anchors = [g.spawn, g.exit, g.rest, ...g.spawnPoints, ...g.chests]
  if (anchors.some(p => circleHitsSolid(p, RADIUS, g))) return false
  const routeGeometry = { ...g, solids: g.solids.filter(solid => solid.kind !== 'door'), doors: g.doors.map(door => ({ ...door, opened: true })) }
  const grid = buildNavGrid(routeGeometry, { cellSize: TILE, actorRadius: RADIUS })
  // Find a route that remains safe throughout every trap phase. This changes
  // only the generation proof; traps stay traversable during actual gameplay.
  for (const cell of grid.cells.values()) if (g.traps.some(trap => pointInDamageArea(cell, trap))) cell.blocked = true
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
