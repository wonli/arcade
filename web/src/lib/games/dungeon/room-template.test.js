import test from 'node:test'
import assert from 'node:assert/strict'

import {
  createEmptyRoomTemplate,
  normalizeRoomTemplate,
  parseRoomTemplate,
  serializeRoomTemplate,
  validateRoomTemplate,
} from './room-template.js'

const wallSource = {
  tileset: 'walls_floor',
  tileId: 246,
  flipX: false,
  flipY: false,
  flipDiagonal: false,
}

const waterSource = {
  tileset: 'Water_coasts_animation',
  tileId: 871,
  flipX: false,
  flipY: false,
  flipDiagonal: false,
}

const archSource = {
  tileset: 'Arches_columns',
  tileId: 134,
  flipX: false,
  flipY: false,
  flipDiagonal: false,
}

test('creates a native empty room without inventing wall geometry', () => {
  const template = createEmptyRoomTemplate({ id: 'test-room', width: 12, height: 10 })

  assert.equal(template.schema, 'dungeon3-room-template')
  assert.equal(template.version, 1)
  assert.deepEqual(template.grid, { tileSize: 16, width: 12, height: 10 })
  assert.equal(template.cells.length, 120)
  assert.ok(template.cells.every((cell) => cell.kind === 'floor' && cell.level === 1))
  assert.deepEqual(template.walls, [])
  assert.deepEqual(template.ports, [])
  assert.deepEqual(template.features, [])
  assert.deepEqual(template.objects, [])
  assert.deepEqual(template.anchors, [])
})

test('normalizes optional layers and round-trips authored source cells exactly', () => {
  const source = createEmptyRoomTemplate({ id: 'authored-room', width: 8, height: 6 })
  source.cells[2 + 2 * 8] = { x: 2, y: 2, kind: 'water', level: 1 }
  source.walls.push({
    id: 'west-wall',
    edge: 'west',
    cells: [{ x: 0, y: 1, source: wallSource }],
  })
  source.ports.push({ id: 'door-east', edge: 'east', x: 7, y: 2, kind: 'door', level: 1, water: false })
  source.features.push({
    id: 'arch-bridge',
    kind: 'bridge',
    bridgeType: 'arch',
    x: 2,
    y: 2,
    width: 1,
    height: 1,
    source: { cells: [{ x: 0, y: 0, source: archSource }] },
  })
  source.features.push({
    id: 'water-tile',
    kind: 'water',
    x: 2,
    y: 2,
    width: 1,
    height: 1,
    source: { cells: [{ x: 0, y: 0, source: waterSource }] },
  })

  const result = validateRoomTemplate(source)
  assert.equal(result.valid, true)
  assert.deepEqual(result.value.walls[0].cells[0].source, wallSource)

  const parsed = parseRoomTemplate(serializeRoomTemplate(source))
  assert.deepEqual(parsed, result.value)

  const normalized = normalizeRoomTemplate({
    schema: 'dungeon3-room-template',
    version: 1,
    id: 'minimal',
    grid: { tileSize: 16, width: 2, height: 2 },
    cells: [{ x: 0, y: 0, kind: 'floor', level: 1 }],
  })
  assert.deepEqual(normalized.ports, [])
  assert.deepEqual(normalized.features, [])
  assert.deepEqual(normalized.placements, [])
})

test('rejects unknown tilesets, invalid tile ids and off-grid authored cells', () => {
  const base = createEmptyRoomTemplate({ id: 'invalid-room', width: 4, height: 4 })
  base.walls.push({ id: 'bad-wall', edge: 'west', cells: [{ x: 0, y: 0, source: { ...wallSource, tileset: 'missing' } }] })
  base.features.push({
    id: 'bad-tile',
    kind: 'decoration',
    x: 3,
    y: 3,
    width: 1,
    height: 1,
    source: { cells: [{ x: 0, y: 0, source: { ...wallSource, tileId: 999999 } }] },
  })
  base.objects.push({ id: 'off-grid', x: 4, y: 1 })

  const result = validateRoomTemplate(base)
  assert.equal(result.valid, false)
  assert.ok(result.errors.some((error) => error.message.includes('Unknown tileset')))
  assert.ok(result.errors.some((error) => error.message.includes('out of range')))
  assert.ok(result.errors.some((error) => error.path.includes('objects[0]')))
})

test('rejects an arch bridge without water under its footprint', () => {
  const template = createEmptyRoomTemplate({ id: 'dry-bridge', width: 4, height: 4 })
  template.features.push({
    id: 'dry-arch',
    kind: 'bridge',
    bridgeType: 'arch',
    x: 1,
    y: 1,
    width: 2,
    height: 1,
    source: { cells: [{ x: 0, y: 0, source: archSource }] },
  })

  const result = validateRoomTemplate(template)
  assert.equal(result.valid, false)
  assert.ok(result.errors.some((error) => error.message.includes('water')))
})

test('rejects a cross-level door port', () => {
  const template = createEmptyRoomTemplate({ id: 'cross-level-door', width: 4, height: 4 })
  template.ports.push({
    id: 'bad-door',
    edge: 'north',
    x: 1,
    y: 0,
    kind: 'door',
    level: 1,
    targetLevel: 2,
    levelDelta: 1,
    water: false,
  })

  const result = validateRoomTemplate(template)
  assert.equal(result.valid, false)
  assert.ok(result.errors.some((error) => error.message.includes('same level')))
})
