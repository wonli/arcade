import { buildNavGrid, findPath } from './pathfinding.js'
import { circleHitsSolid } from './spatial.js'
import { dungeon3Rules } from './dungeon3-rules.js'

const TILE = 16
const WIDTH = 960
const HEIGHT = 600
const COLS = WIDTH / TILE
const ROWS = Math.floor(HEIGHT / TILE)
const RADIUS = 20
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

function build(seed, floor, attempt) {
  const random = rng(seed + Math.imul(attempt, 0x9e3779b9))
  const cells = Array.from({ length: COLS * ROWS }, (_, i) => {
    const x = i % COLS, y = Math.floor(i / COLS)
    return { kind: x < 3 || x >= 57 || y < 3 || y >= 34 ? 'boundary' : 'water', level: 0 }
  })
  const rooms = []
  const levels = shuffle(random, [0, 1, 2, 0, 1, 2])
  for (let row = 0; row < 2; row++) for (let column = 0; column < 3; column++) {
    const cx = 176 + column * 304, cy = 176 + row * 256
    const width = pick(random, [192, 224, 256]), height = pick(random, [160, 192])
    rooms.push(rect(cx - width / 2, cy - height / 2, width, height, 'room', { id: rooms.length, level: levels[rooms.length], center: point(cx, cy) }))
  }
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
  // A connected perimeter leaves distinct rooms and waterways; one extra crossing
  // changes the loop structure while every floor retains at least one alternate route.
  const edges = [[0, 1], [1, 2], [2, 5], [5, 4], [4, 3], [3, 0]]
  if (random() < 0.6) edges.push([1, 4])
  const paths = [], bridges = []
  for (const [a, b] of edges) {
    const from = rooms[a].center, to = rooms[b].center
    const horizontal = from.y === to.y
    const path = horizontal
      ? rect(Math.min(from.x, to.x) - 48, from.y - 48, Math.abs(to.x - from.x) + 96, 96, 'path')
      : rect(from.x - 48, Math.min(from.y, to.y) - 48, 96, Math.abs(to.y - from.y) + 96, 'path')
    path.from = a; path.to = b; path.level = rooms[a].level
    paths.push(path)
    const lower = horizontal ? (from.x < to.x ? rooms[a] : rooms[b]) : (from.y < to.y ? rooms[a] : rooms[b])
    const upper = lower === rooms[a] ? rooms[b] : rooms[a]
    bridges.push(horizontal
      ? rect(lower.x + lower.width - 16, from.y - 48, upper.x - lower.x - lower.width + 32, 96, 'bridge', { orientation: 'horizontal' })
      : rect(from.x - 48, lower.y + lower.height - 16, 96, upper.y - lower.y - lower.height + 32, 'bridge', { orientation: 'vertical' }))
    carve(path, 'bridge', path.level, true)
  }
  const g = {
    name: 'dungeon3-grid', seed, floor, width: WIDTH, height: HEIGHT,
    bounds: { x: 48, y: 48, width: 864, height: 496 },
    grid: { tileSize: TILE, columns: COLS, rows: ROWS, cells }, rooms, paths, bridges,
    water: rectanglesFor(cells, 'water'),
    solids: [...rectanglesFor(cells, 'boundary'), rect(0, ROWS * TILE, WIDTH, HEIGHT - ROWS * TILE, 'boundary')],
    stairs: [], doors: [], traps: [], decorations: [], torches: [], chests: [], spawnPoints: [], criticalPath: [],
  }
  const start = Math.floor(random() * rooms.length)
  const finish = [5, 3, 4, 1, 2, 0][start]
  const anchor = (room) => point(room.center.x + pick(random, [-32, 0, 32]), room.center.y + pick(random, [-16, 16]))
  g.spawn = anchor(rooms[start]); g.exit = anchor(rooms[finish]); g.rest = { ...rooms[(start + 1) % 6].center }
  g.spawnPoints = rooms.map(room => ({ ...room.center }))
  g.chests = [{ ...rooms[(start + 2) % 6].center }]
  // Exits are floor transitions; portal rendering owns the complete marker.
  for (const bridge of bridges) {
    const horizontal = bridge.orientation === 'horizontal'
    g.stairs.push({ x: horizontal ? bridge.x + 16 : bridge.x + bridge.width / 2, y: horizontal ? bridge.y + bridge.height / 2 : bridge.y + 16, orientation: horizontal ? 'right' : 'down' })
    g.stairs.push({ x: horizontal ? bridge.x + bridge.width - 16 : bridge.x + bridge.width / 2, y: horizontal ? bridge.y + bridge.height / 2 : bridge.y + bridge.height - 16, orientation: horizontal ? 'left' : 'up' })
  }
  const reserved = [g.spawn, g.exit, g.rest, ...g.chests, ...g.spawnPoints]
  const motifPools = [['coffin', dungeon3Rules.motifs.coffins], ['object', dungeon3Rules.motifs.otherObjects]]
  for (const room of rooms) {
    for (const [kind, pool] of motifPools) {
      const motifs = shuffle(random, pool.filter(m => m.width <= 4 && m.height <= 4))
      for (const motif of motifs) {
        const width = motif.width * TILE, height = motif.height * TILE
        const candidates = shuffle(random, [
          point(room.x + 16, room.y + 16), point(room.x + room.width - width - 16, room.y + 16),
          point(room.x + 16, room.y + room.height - height - 16), point(room.x + room.width - width - 16, room.y + room.height - height - 16),
        ])
        const area = candidates.map(p => rect(p.x, p.y, width, height, 'decoration')).find(area =>
          inside(point(area.x, area.y), room, 16) && inside(point(area.x + width, area.y + height), room, 16) &&
          !paths.some(path => overlaps(area, path, 8)) &&
          !reserved.some(p => overlaps(area, rect(p.x - 28, p.y - 28, 56, 56, 'reserved'), 8)) &&
          !g.decorations.some(d => overlaps(area, rect(d.x - d.footprint.width / 2, d.y - d.footprint.height / 2, d.footprint.width, d.footprint.height, 'prop'), 8)))
        if (!area) continue
        g.decorations.push({ x: area.x + width / 2, y: area.y + height / 2, kind, motif, footprint: { width, height } })
        g.solids.push({ ...area, kind: 'prop', authored: true })
        break
      }
    }
    // Lighting is a non-blocking accent on each platform.
    g.torches.push(point(room.center.x, room.y + 32))
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
  for (let attempt = 0; attempt < 8; attempt++) {
    const geometry = build(seed, floor, attempt)
    if (validate(geometry)) return geometry
  }
  // The fallback follows exactly the same validation; never return an unchecked map.
  const fallback = build(seed, floor, 0)
  fallback.decorations = []; fallback.solids = fallback.solids.filter(s => !s.authored)
  if (!validate(fallback)) throw new Error(`Dungeon3 map is disconnected: ${seed}/${floor}`)
  return fallback
}
