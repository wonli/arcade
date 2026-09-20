import { createEmptyRoomTemplate, normalizeRoomTemplate, validateRoomTemplate } from './room-template.js'
import { listDungeon3RoomAssets } from './room-template-assets.js'

function clone(value) {
  return JSON.parse(JSON.stringify(value))
}

function errorState(state, errors) {
  return { ...state, errors: Array.isArray(errors) ? errors : [{ path: '', message: String(errors) }] }
}

function applyTemplate(state, template) {
  const result = validateRoomTemplate(template)
  if (!result.valid) return errorState(state, result.errors)
  return { ...state, template: result.value, errors: [] }
}

function placementSize(asset, rotation) {
  return rotation % 180 === 0
    ? { width: asset.width, height: asset.height }
    : { width: asset.height, height: asset.width }
}

function normalizeRotation(rotation) {
  const value = Number.isFinite(rotation) ? rotation : 0
  return ((value % 360) + 360) % 360
}

function covers(entry, x, y) {
  return x >= entry.x && x < entry.x + (entry.width ?? 1) && y >= entry.y && y < entry.y + (entry.height ?? 1)
}

function makePlacementId(template, asset) {
  return `${asset.key.replaceAll('.', '-')}-${template.placements.length + 1}`
}

function sourceCells(asset) {
  return asset.cells.map((cell) => ({ x: cell.x, y: cell.y, source: clone(cell) }))
}

export function createRoomEditorState(template) {
  const normalized = normalizeRoomTemplate(template)
  const result = validateRoomTemplate(normalized)
  return {
    template: result.valid ? result.value : normalized,
    selectedAsset: null,
    selectedTool: 'place',
    errors: result.valid ? [] : result.errors,
  }
}

export function placeAsset(state, asset, x, y, options = {}) {
  if (!asset) return errorState(state, [{ path: 'asset', message: 'No asset selected' }])
  const rotation = normalizeRotation(options.rotation)
  if (!asset.allowedRotations.includes(rotation)) {
    return errorState(state, [{ path: 'rotation', message: `${asset.key} does not allow rotation ${rotation}` }])
  }
  if (!Number.isInteger(x) || !Number.isInteger(y)) return errorState(state, [{ path: 'position', message: 'Position must be on the integer tile grid' }])

  const size = placementSize(asset, rotation)
  const template = clone(state.template)
  const id = makePlacementId(template, asset)
  const placement = {
    id,
    asset: asset.key,
    kind: asset.kind,
    semantic: asset.semantic,
    x,
    y,
    width: size.width,
    height: size.height,
    rotation,
    source: { cells: sourceCells(asset) },
  }
  template.placements.push(placement)

  if (asset.kind === 'water') {
    const cells = new Map(template.cells.map((cell) => [`${cell.x},${cell.y}`, cell]))
    for (let offset = 0; offset < size.width * size.height; offset += 1) {
      const cellX = x + offset % size.width
      const cellY = y + Math.floor(offset / size.width)
      const key = `${cellX},${cellY}`
      const current = cells.get(key) ?? { x: cellX, y: cellY, level: 1 }
      cells.set(key, { ...current, kind: 'water', water: true })
    }
    template.cells = [...cells.values()].sort((a, b) => a.y - b.y || a.x - b.x)
  }

  const semanticEntry = {
    id,
    kind: asset.kind === 'bridge' ? 'bridge' : asset.kind,
    asset: asset.key,
    semantic: asset.semantic,
    x,
    y,
    width: size.width,
    height: size.height,
    rotation,
    source: { cells: sourceCells(asset) },
  }
  if (asset.kind === 'wall') template.walls.push(semanticEntry)
  else template.features.push(semanticEntry)

  return applyTemplate(state, template)
}

export function eraseAt(state, x, y) {
  const template = clone(state.template)
  const removedIds = new Set(template.placements.filter((entry) => covers(entry, x, y)).map((entry) => entry.id))
  template.placements = template.placements.filter((entry) => !removedIds.has(entry.id))
  template.walls = template.walls.filter((entry) => !removedIds.has(entry.id) && !covers(entry, x, y))
  template.features = template.features.filter((entry) => !removedIds.has(entry.id) && !covers(entry, x, y))
  template.ports = template.ports.filter((port) => port.x !== x || port.y !== y)
  return applyTemplate(state, template)
}

export function setCellKind(state, x, y, kind) {
  const template = clone(state.template)
  const index = template.cells.findIndex((cell) => cell.x === x && cell.y === y)
  const current = index >= 0 ? template.cells[index] : { x, y, level: 1 }
  const next = { ...current, x, y, kind }
  if (kind === 'water') next.water = true
  else delete next.water
  if (index >= 0) template.cells[index] = next
  else template.cells.push(next)
  return applyTemplate(state, template)
}

export function placePort(state, port) {
  const template = clone(state.template)
  template.ports.push(clone(port))
  return applyTemplate(state, template)
}

export function createResourceShowcaseTemplate(options = {}) {
  const width = Math.max(Number.isInteger(options.width) ? options.width : 32, 24)
  const height = Math.max(Number.isInteger(options.height) ? options.height : 20, 16)
  const assets = listDungeon3RoomAssets()
  const byKey = new Map(assets.map((asset) => [asset.key, asset]))
  const empty = createRoomEditorState(createEmptyRoomTemplate({
    id: options.id || 'resource-showcase',
    name: options.name || 'Dungeon3 resource showcase',
    width,
    height,
  }))
  let state = empty
  const requireSuccess = (next) => {
    if (next.errors.length) throw new Error(next.errors.map((error) => error.message).join('; '))
    return next
  }

  const place = (key, x, y) => { state = requireSuccess(placeAsset(state, byKey.get(key), x, y)) }
  place('water.body', 1, 1)
  place('water.edge.n', 3, 1)
  place('water.edge.w', 5, 1)
  place('wall.vertical.west', 1, 4)
  place('wall.vertical.east', 3, 4)
  place('wall.vertical.body', 5, 4)
  place('wall.horizontal', 7, 4)
  place('door.closed', 10, 4)
  place('door.open', 13, 4)
  place('stairs.default', 17, 4)

  for (let y = 11; y < 13; y += 1) {
    for (let x = 1; x < 19; x += 1) state = requireSuccess(setCellKind(state, x, y, 'water'))
  }
  place('bridge.flat', 2, 11)
  place('bridge.arch', 6, 11)
  state = requireSuccess(placePort(state, { id: 'port-west', edge: 'west', x: 0, y: 5, kind: 'door', level: 1, water: false }))
  state = requireSuccess(placePort(state, { id: 'port-east', edge: 'east', x: width - 1, y: 5, kind: 'door', level: 1, water: false }))
  return state.template
}
