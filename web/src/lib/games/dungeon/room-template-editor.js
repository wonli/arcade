import { normalizeRoomTemplate, validateRoomTemplate } from './room-template.js'

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
