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

function stampAsset(template, asset, x, y, rotation) {
  const size = placementSize(asset, rotation)
  const id = makePlacementId(template, asset)
  const source = { cells: sourceCells(asset) }
  template.placements.push({
    id,
    asset: asset.key,
    kind: asset.kind,
    semantic: asset.semantic,
    x,
    y,
    width: size.width,
    height: size.height,
    rotation,
    source,
  })

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
    source,
  }
  if (asset.kind === 'wall') template.walls.push(semanticEntry)
  else template.features.push(semanticEntry)
  return template
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

export function getTemplateAssetKeys(template) {
  const seen = new Set()
  return (template.placements ?? [])
    .map((placement) => placement.asset)
    .filter((asset) => {
      if (!asset || seen.has(asset)) return false
      seen.add(asset)
      return true
    })
}

function selectionBounds(rect) {
  const x = Number.isInteger(rect?.x) ? rect.x : 0
  const y = Number.isInteger(rect?.y) ? rect.y : 0
  const width = Number.isInteger(rect?.width) ? rect.width : 1
  const height = Number.isInteger(rect?.height) ? rect.height : 1
  const right = x + width
  const bottom = y + height
  return {
    left: Math.min(x, right),
    top: Math.min(y, bottom),
    right: Math.max(x, right),
    bottom: Math.max(y, bottom),
  }
}

export function selectPlacementIds(template, rect) {
  const bounds = selectionBounds(rect)
  return (template.placements ?? [])
    .filter((placement) => (
      placement.x < bounds.right
      && placement.x + (placement.width ?? 1) > bounds.left
      && placement.y < bounds.bottom
      && placement.y + (placement.height ?? 1) > bounds.top
    ))
    .map((placement) => placement.id)
}

export function movePlacements(state, ids, dx, dy) {
  const selected = new Set(ids)
  if (!selected.size) return state
  if (!Number.isInteger(dx) || !Number.isInteger(dy)) return errorState(state, [{ path: 'selection', message: `Move offset must be an integer (${dx}, ${dy})` }])

  const template = clone(state.template)
  const placements = template.placements.filter((placement) => selected.has(placement.id))
  if (placements.length !== selected.size) return errorState(state, [{ path: 'selection', message: 'Selection contains an unknown placement' }])
  for (const placement of placements) {
    const nextX = placement.x + dx
    const nextY = placement.y + dy
    if (nextX < 0 || nextY < 0 || nextX + placement.width > template.grid.width || nextY + placement.height > template.grid.height) {
      return errorState(state, [{ path: 'selection', message: 'Selection cannot move outside the room' }])
    }
  }

  const moveEntry = (entry) => selected.has(entry.id) ? { ...entry, x: entry.x + dx, y: entry.y + dy } : entry
  template.placements = template.placements.map(moveEntry)
  for (const layer of ['walls', 'features', 'objects', 'anchors']) template[layer] = template[layer].map(moveEntry)
  return applyTemplate(state, template)
}

export function deletePlacements(state, ids) {
  const selected = new Set(ids)
  if (!selected.size) return state
  const template = clone(state.template)
  template.placements = template.placements.filter((placement) => !selected.has(placement.id))
  for (const layer of ['walls', 'features', 'objects', 'anchors']) template[layer] = template[layer].filter((entry) => !selected.has(entry.id))
  return applyTemplate(state, template)
}

export function placeAsset(state, asset, x, y, options = {}) {
  if (!asset) return errorState(state, [{ path: 'asset', message: 'No asset selected' }])
  const rotation = normalizeRotation(options.rotation)
  if (!asset.allowedRotations.includes(rotation)) {
    return errorState(state, [{ path: 'rotation', message: `${asset.key} does not allow rotation ${rotation}` }])
  }
  if (!Number.isInteger(x) || !Number.isInteger(y)) return errorState(state, [{ path: 'position', message: 'Position must be on the integer tile grid' }])

  const template = stampAsset(clone(state.template), asset, x, y, rotation)

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

export const ROOM_SCENARIOS = [
  { key: 'wall', label: '围墙房', description: '只校正围墙：横墙、左侧边缘、右侧边缘和中段竖墙。' },
  { key: 'water', label: '水域房', description: '开阔水面、水岸和水面细节的组合。' },
  { key: 'door', label: '门洞房', description: '只校正门洞：关闭门、开启门和门两侧的墙体。' },
  { key: 'flat-bridge', label: '平桥房', description: '同层水域与平桥连接。' },
  { key: 'arch-bridge', label: '拱桥房', description: 'Arches_columns 拱桥跨越水域。' },
  { key: 'empty', label: '纯网格底稿', description: '只保留地板网格；这是空白底稿，不是资源组合样板。' },
  { key: 'boss', label: 'Boss 房', description: '雕像、浮雕、烛台、门与战斗空间。' },
  { key: 'trap', label: '陷阱房', description: '地面陷阱、墙面陷阱和尖刺组合。' },
  { key: 'treasure', label: '宝物房', description: '棺材、物件、地面板块与门的组合。' },
  { key: 'all-assets', label: '全资源索引', description: '按资源来源分格摆出完整提取目录。' },
]

function scenarioBuilder(options, width, height) {
  const assets = listDungeon3RoomAssets()
  const byKey = new Map(assets.map((asset) => [asset.key, asset]))
  let state = createRoomEditorState(createEmptyRoomTemplate({
    id: options.id || 'dungeon3-scenario',
    name: options.name || 'Dungeon3 scenario',
    width,
    height,
  }))
  const requireSuccess = (next) => {
    if (next.errors.length) throw new Error(next.errors.map((error) => `${error.path}: ${error.message}`).join('; '))
    state = next
  }
  const asset = (key) => byKey.get(key)
  const place = (key, x, y, placeOptions) => requireSuccess(placeAsset(state, asset(key), x, y, placeOptions))
  const water = (x0, y0, width0, height0) => {
    for (let y = y0; y < y0 + height0; y += 1) for (let x = x0; x < x0 + width0; x += 1) requireSuccess(setCellKind(state, x, y, 'water'))
  }
  const port = (id, edge, x, y) => requireSuccess(placePort(state, { id, edge, x, y, kind: 'door', level: 1, water: false }))
  return { get state() { return state }, place, water, port, asset }
}

function createAllAssetsShowcase(options = {}) {
  const assets = listDungeon3RoomAssets()
  const columns = 4
  const slotWidth = 20
  const slotHeight = 12
  const rows = Math.ceil(assets.length / columns)
  const width = Math.max(Number.isInteger(options.width) ? options.width : columns * slotWidth, columns * slotWidth)
  const height = Math.max(Number.isInteger(options.height) ? options.height : rows * slotHeight + 2, rows * slotHeight + 2)
  let template = createEmptyRoomTemplate({
    id: options.id || 'resource-showcase',
    name: options.name || 'Dungeon3 complete resource index',
    width,
    height,
  })
  assets.forEach((resource, index) => {
    const x = (index % columns) * slotWidth + 1
    const y = Math.floor(index / columns) * slotHeight + 1
    if (resource.kind === 'bridge') {
      for (let cellY = y; cellY < y + resource.height; cellY += 1) {
        for (let cellX = x; cellX < x + resource.width; cellX += 1) {
          const cell = template.cells.find((candidate) => candidate.x === cellX && candidate.y === cellY)
          if (cell) cell.kind = 'water'
        }
      }
    }
    template = stampAsset(template, resource, x, y, 0)
  })
  template.ports.push({ id: 'index-west', edge: 'west', x: 0, y: 1, kind: 'door', level: 1, water: false })
  template.ports.push({ id: 'index-east', edge: 'east', x: width - 1, y: 1, kind: 'door', level: 1, water: false })
  const result = validateRoomTemplate(template)
  if (!result.valid) throw new Error(result.errors.map((error) => `${error.path}: ${error.message}`).join('; '))
  return result.value
}

export function createResourceShowcaseTemplate(options = {}) {
  return createAllAssetsShowcase({ ...options, id: options.id || 'resource-showcase' })
}

export function createRoomScenarioTemplate(scenario = 'all-assets', options = {}) {
  if (scenario === 'all-assets') return createAllAssetsShowcase(options)
  if (scenario === 'empty') return createEmptyRoomTemplate({ id: options.id || 'empty-room', name: options.name || 'Empty room', width: 24, height: 16 })

  if (scenario === 'wall') {
    const builder = scenarioBuilder({ ...options, name: options.name || 'Wall chamber' }, 32, 20)
    // Match room-03.json: this authored wall leaves a two-cell opening and
    // frames it with the Arches_columns cap on both sides. Do not generalize
    // the cap to ordinary wall ends or the other wall runs in this scenario.
    for (const x of [5, 7, 9, 11, 13]) builder.place('wall.horizontal', x, 2)
    builder.place('wall-cap.09', 15, 2)
    builder.place('wall-cap.09', 18, 2)
    for (const x of [19, 21, 23, 25]) builder.place('wall.horizontal', x, 2)
    builder.place('wall.vertical.west', 1, 4)
    builder.place('wall.vertical.east', 29, 4)
    for (const y of [5, 8, 11]) builder.place('wall.vertical.body', 3, y)
    for (const x of [5, 7, 9, 11, 13, 15, 17, 19, 21, 23, 25]) builder.place('wall.horizontal', x, 15)
    builder.port('wall-west', 'west', 0, 9)
    builder.port('wall-east', 'east', 31, 9)
    return builder.state.template
  }

  if (scenario === 'water') {
    const builder = scenarioBuilder({ ...options, name: options.name || 'Water chamber' }, 32, 20)
    builder.water(6, 5, 20, 9)
    builder.place('water.body', 7, 6)
    builder.place('water.edge.n', 9, 5)
    builder.place('water.edge.w', 6, 7)
    builder.place('assembly.waterLong', 10, 7)
    builder.place('assembly.waterRipple', 14, 10)
    builder.place('assembly.waterFoam', 20, 5)
    builder.place('assembly.underwaterRuin', 18, 12)
    builder.place('wall.vertical.west', 1, 3)
    builder.place('wall.vertical.east', 29, 3)
    builder.port('water-west', 'west', 0, 9)
    builder.port('water-east', 'east', 31, 9)
    return builder.state.template
  }

  if (scenario === 'door') {
    const builder = scenarioBuilder({ ...options, name: options.name || 'Doorway chamber' }, 32, 20)
    // Match the authored doorway chamber: the 2x3 wall segments continue
    // right up to both sides of the 2x3 door frame. The end-cap strips are
    // separate vertical assets and sit on both the upper and lower wall runs.
    for (const x of [3, 5, 7, 9, 11, 13]) builder.place('wall.horizontal', x, 2)
    builder.place('door.closed', 15, 2)
    for (const x of [17, 19, 21, 23, 25, 27]) builder.place('wall.horizontal', x, 2)
    builder.place('wall.vertical.west', 2, 2)
    builder.place('wall.vertical.east', 29, 2)
    builder.place('wall.horizontal', 0, 5)
    builder.place('wall.horizontal', 30, 5)
    for (const x of [3, 5, 7, 9, 11, 13]) builder.place('wall.horizontal', x, 13)
    builder.place('door.open', 15, 13)
    for (const x of [17, 19, 21, 23, 25, 27]) builder.place('wall.horizontal', x, 13)
    builder.place('wall.vertical.west', 2, 13)
    builder.place('wall.vertical.east', 29, 13)
    builder.place('wall.horizontal', 0, 16)
    builder.place('wall.horizontal', 30, 16)
    builder.port('door-west', 'west', 0, 9)
    builder.port('door-east', 'east', 31, 9)
    return builder.state.template
  }

  if (scenario === 'flat-bridge') {
    const builder = scenarioBuilder({ ...options, name: options.name || 'Flat bridge chamber' }, 32, 20)
    builder.water(4, 7, 24, 5)
    builder.place('water.body', 5, 8)
    builder.place('assembly.waterLong', 8, 8)
    for (let x = 12; x < 20; x += 1) builder.place('bridge.flat', x, 8)
    builder.place('wall.vertical.west', 1, 6)
    builder.place('wall.vertical.east', 29, 6)
    builder.place('door.closed', 14, 4)
    builder.port('flat-west', 'west', 0, 8)
    builder.port('flat-east', 'east', 31, 8)
    return builder.state.template
  }

  if (scenario === 'arch-bridge') {
    const builder = scenarioBuilder({ ...options, name: options.name || 'Arch bridge chamber' }, 32, 20)
    builder.water(4, 7, 24, 5)
    builder.place('water.body', 5, 8)
    builder.place('assembly.waterRipple', 20, 9)
    builder.place('bridge.arch', 12, 8)
    builder.place('wall.vertical.west', 1, 6)
    builder.place('wall.vertical.east', 29, 6)
    builder.port('arch-west', 'west', 0, 8)
    builder.port('arch-east', 'east', 31, 8)
    return builder.state.template
  }

  if (scenario === 'boss') {
    const builder = scenarioBuilder({ ...options, name: options.name || 'Boss chamber' }, 32, 22)
    for (const x of [1, 3, 5, 7, 9, 11, 21, 23, 25, 27, 29]) builder.place('wall.horizontal', x, 2)
    builder.place('assembly.statue', 13, 4)
    builder.place('relief.01', 10, 5)
    builder.place('relief.02', 20, 5)
    builder.place('candle.01', 8, 8)
    builder.place('candle.02', 22, 8)
    builder.place('arch-decoration.01', 3, 8)
    builder.place('door.closed', 15, 15)
    builder.place('stairs.default', 15, 18)
    builder.port('boss-south', 'south', 15, 21)
    return builder.state.template
  }

  if (scenario === 'trap') {
    const builder = scenarioBuilder({ ...options, name: options.name || 'Trap chamber' }, 32, 20)
    builder.place('assembly.wallTrap', 2, 3)
    builder.place('assembly.wallTrap', 27, 3)
    builder.place('assembly.spikes', 7, 6)
    builder.place('assembly.spikes', 21, 6)
    for (const [key, x, y] of [['assembly.floorTrap', 10, 10], ['assembly.floorTrap', 14, 10], ['assembly.floorTrap', 18, 10], ['plate.01', 5, 13]]) builder.place(key, x, y)
    builder.place('door.closed', 15, 2)
    builder.place('wall.vertical.west', 1, 4)
    builder.place('wall.vertical.east', 30, 4)
    return builder.state.template
  }

  if (scenario === 'treasure') {
    const builder = scenarioBuilder({ ...options, name: options.name || 'Treasure chamber' }, 32, 20)
    builder.place('coffin.01', 4, 4)
    builder.place('coffin.02', 24, 4)
    builder.place('object.01', 9, 7)
    builder.place('object.02', 19, 7)
    builder.place('object.03', 13, 12)
    builder.place('candle.03', 3, 13)
    builder.place('candle.04', 26, 13)
    builder.place('plate.02', 12, 4)
    builder.place('door.open', 15, 2)
    builder.place('wall.vertical.west', 1, 3)
    builder.place('wall.vertical.east', 30, 3)
    return builder.state.template
  }

  return createEmptyRoomTemplate({ id: options.id || 'empty-room', name: options.name || 'Empty room', width: 24, height: 16 })
}
