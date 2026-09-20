import { dungeon3Rules } from './dungeon3-rules.js'

export const ROOM_TEMPLATE_SCHEMA = 'dungeon3-room-template'
export const ROOM_TEMPLATE_VERSION = 1
export const ROOM_TILE_SIZE = 16

const PORT_EDGES = new Set(['north', 'east', 'south', 'west'])
const OPTIONAL_ARRAYS = ['walls', 'ports', 'features', 'objects', 'anchors', 'placements']

function clone(value) {
  return value == null ? value : JSON.parse(JSON.stringify(value))
}

function isRecord(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

function integer(value) {
  return Number.isInteger(value)
}

function cellKey(x, y) {
  return `${x},${y}`
}

function pushError(errors, path, message) {
  errors.push({ path, message })
}

function validateGridPoint(point, path, grid, errors) {
  if (!isRecord(point) || !integer(point.x) || !integer(point.y)) {
    pushError(errors, path, 'Expected integer x and y coordinates')
    return
  }
  if (point.x < 0 || point.x >= grid.width || point.y < 0 || point.y >= grid.height) {
    pushError(errors, path, `Cell is off-grid: (${point.x}, ${point.y})`)
  }
}

function validateSourceRefs(value, path, errors, seen = new Set()) {
  if (!value || typeof value !== 'object') return
  if (seen.has(value)) return
  seen.add(value)

  if (isRecord(value) && ('tileset' in value || 'tileId' in value)) {
    if (typeof value.tileset !== 'string' || !value.tileset) {
      pushError(errors, path, 'Source ref is missing a tileset')
    } else {
      const tileset = dungeon3Rules.tilesets[value.tileset]
      if (!tileset) {
        pushError(errors, `${path}.tileset`, `Unknown tileset: ${value.tileset}`)
      } else if (!integer(value.tileId) || value.tileId < 0 || value.tileId >= tileset.tileCount) {
        pushError(errors, `${path}.tileId`, `Tile id is out of range for ${value.tileset}`)
      }
    }
  }

  for (const [key, child] of Object.entries(value)) {
    if (key === 'tileset' || key === 'tileId' || key === 'flipX' || key === 'flipY' || key === 'flipDiagonal') continue
    if (child && typeof child === 'object') validateSourceRefs(child, `${path}.${key}`, errors, seen)
  }
}

function validateLayerPoints(layer, path, grid, errors) {
  if (!Array.isArray(layer)) {
    pushError(errors, path, 'Expected an array')
    return
  }
  for (let index = 0; index < layer.length; index += 1) {
    const entry = layer[index]
    if (!isRecord(entry)) {
      pushError(errors, `${path}[${index}]`, 'Expected an object')
      continue
    }
    if ('x' in entry || 'y' in entry) validateGridPoint(entry, `${path}[${index}]`, grid, errors)
    if (integer(entry.width) && integer(entry.height)) {
      if (entry.width <= 0 || entry.height <= 0) pushError(errors, `${path}[${index}]`, 'Width and height must be positive')
      if (integer(entry.x) && integer(entry.y) && (entry.x + entry.width > grid.width || entry.y + entry.height > grid.height)) {
        pushError(errors, `${path}[${index}]`, 'Footprint is off-grid')
      }
    }
  }
}

export function createEmptyRoomTemplate(options = {}) {
  const width = Number.isInteger(options.width) && options.width > 0 ? options.width : 16
  const height = Number.isInteger(options.height) && options.height > 0 ? options.height : 12
  const id = typeof options.id === 'string' && options.id ? options.id : 'untitled-room'

  return {
    schema: ROOM_TEMPLATE_SCHEMA,
    version: ROOM_TEMPLATE_VERSION,
    id,
    name: typeof options.name === 'string' && options.name ? options.name : id,
    grid: { tileSize: ROOM_TILE_SIZE, width, height },
    cells: Array.from({ length: width * height }, (_, index) => {
      const x = index % width
      const y = Math.floor(index / width)
      return { x, y, kind: 'floor', level: 1 }
    }),
    walls: [],
    ports: [],
    features: [],
    objects: [],
    anchors: [],
    placements: [],
  }
}

export function normalizeRoomTemplate(value) {
  const template = clone(value)
  if (!isRecord(template)) return template

  for (const key of OPTIONAL_ARRAYS) {
    if (!Array.isArray(template[key])) template[key] = []
  }
  if (!Array.isArray(template.cells)) template.cells = []
  if (!isRecord(template.grid)) template.grid = {}
  if (template.grid.tileSize == null) template.grid.tileSize = ROOM_TILE_SIZE
  if (template.name == null && typeof template.id === 'string') template.name = template.id
  return template
}

export function validateRoomTemplate(input) {
  const template = normalizeRoomTemplate(input)
  const errors = []

  if (!isRecord(template)) return { valid: false, errors: [{ path: '', message: 'Template must be an object' }] }
  if (template.schema !== ROOM_TEMPLATE_SCHEMA) pushError(errors, 'schema', `Expected ${ROOM_TEMPLATE_SCHEMA}`)
  if (template.version !== ROOM_TEMPLATE_VERSION) pushError(errors, 'version', `Expected version ${ROOM_TEMPLATE_VERSION}`)
  if (!isRecord(template.grid)) {
    pushError(errors, 'grid', 'Expected a grid object')
  } else {
    if (template.grid.tileSize !== ROOM_TILE_SIZE) pushError(errors, 'grid.tileSize', `Expected ${ROOM_TILE_SIZE}`)
    if (!integer(template.grid.width) || template.grid.width <= 0) pushError(errors, 'grid.width', 'Expected a positive integer')
    if (!integer(template.grid.height) || template.grid.height <= 0) pushError(errors, 'grid.height', 'Expected a positive integer')
  }

  if (!isRecord(template.grid) || !integer(template.grid.width) || !integer(template.grid.height)) {
    return { valid: false, errors }
  }

  const grid = template.grid
  if (typeof template.id !== 'string' || !template.id) pushError(errors, 'id', 'Expected a non-empty id')

  if (!Array.isArray(template.cells)) {
    pushError(errors, 'cells', 'Expected an array')
  } else {
    const seenCells = new Set()
    for (let index = 0; index < template.cells.length; index += 1) {
      const cell = template.cells[index]
      validateGridPoint(cell, `cells[${index}]`, grid, errors)
      if (!isRecord(cell)) continue
      if (integer(cell.x) && integer(cell.y)) {
        const key = cellKey(cell.x, cell.y)
        if (seenCells.has(key)) pushError(errors, `cells[${index}]`, 'Duplicate logical cell')
        seenCells.add(key)
      }
      if (cell.level !== undefined && !integer(cell.level)) pushError(errors, `cells[${index}].level`, 'Expected an integer level')
      if (cell.kind !== undefined && typeof cell.kind !== 'string') pushError(errors, `cells[${index}].kind`, 'Expected a string kind')
    }
  }

  for (const key of ['walls', 'features', 'objects', 'anchors', 'placements']) validateLayerPoints(template[key], key, grid, errors)

  if (!Array.isArray(template.ports)) {
    pushError(errors, 'ports', 'Expected an array')
  } else {
    for (let index = 0; index < template.ports.length; index += 1) {
      const port = template.ports[index]
      const path = `ports[${index}]`
      if (!isRecord(port)) {
        pushError(errors, path, 'Expected an object')
        continue
      }
      validateGridPoint(port, path, grid, errors)
      if (!PORT_EDGES.has(port.edge)) pushError(errors, `${path}.edge`, 'Expected north, east, south or west')
      if (port.kind === 'door' && (port.levelDelta !== undefined && port.levelDelta !== 0 || port.targetLevel !== undefined && port.targetLevel !== port.level)) {
        pushError(errors, path, 'Door ports must connect rooms on the same level')
      }
    }
  }

  const logicalCells = new Map((template.cells || []).filter((cell) => isRecord(cell) && integer(cell.x) && integer(cell.y)).map((cell) => [cellKey(cell.x, cell.y), cell]))
  for (let index = 0; index < template.features.length; index += 1) {
    const feature = template.features[index]
    if (!isRecord(feature) || feature.kind !== 'bridge') continue
    const width = integer(feature.width) ? feature.width : 1
    const height = integer(feature.height) ? feature.height : 1
    const hasWater = Array.from({ length: width * height }, (_, offset) => {
      const x = feature.x + (offset % width)
      const y = feature.y + Math.floor(offset / width)
      const cell = logicalCells.get(cellKey(x, y))
      return cell && (cell.kind === 'water' || cell.water === true)
    }).some(Boolean)
    if (!hasWater) pushError(errors, `features[${index}]`, 'Bridge footprint must cover at least one water cell')
  }

  validateSourceRefs(template, '', errors)
  return errors.length ? { valid: false, errors } : { valid: true, value: template }
}

export function serializeRoomTemplate(template) {
  const result = validateRoomTemplate(template)
  if (!result.valid) {
    const details = result.errors.map((error) => `${error.path || '<root>'}: ${error.message}`).join('; ')
    throw new Error(`Invalid room template: ${details}`)
  }
  return `${JSON.stringify(result.value, null, 2)}\n`
}

export function parseRoomTemplate(text) {
  let value
  try {
    value = JSON.parse(text)
  } catch (error) {
    throw new Error(`Invalid room template JSON: ${error.message}`)
  }
  const result = validateRoomTemplate(value)
  if (!result.valid) {
    const details = result.errors.map((error) => `${error.path || '<root>'}: ${error.message}`).join('; ')
    throw new Error(`Invalid room template: ${details}`)
  }
  return result.value
}
