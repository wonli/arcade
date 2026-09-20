import test from 'node:test'
import assert from 'node:assert/strict'

import { createEmptyRoomTemplate, validateRoomTemplate } from './room-template.js'
import { listDungeon3RoomAssets } from './room-template-assets.js'
import {
  createRoomEditorState,
  createRoomScenarioTemplate,
  createResourceShowcaseTemplate,
  deletePlacements,
  eraseAt,
  getTemplateAssetKeys,
  movePlacements,
  placeAsset,
  placePort,
  selectPlacementIds,
  setCellKind,
  ROOM_SCENARIOS,
} from './room-template-editor.js'

const assets = listDungeon3RoomAssets()
const find = (key) => assets.find((asset) => asset.key === key)

test('resource showcase uses every catalog asset in a valid authored layout', () => {
  const template = createResourceShowcaseTemplate({ id: 'showcase' })
  const result = new Set(template.placements.map((placement) => placement.asset))

  assert.equal(template.id, 'showcase')
  assert.equal(result.size, assets.length)
  for (const asset of assets) assert.ok(result.has(asset.key), `showcase missing ${asset.key}`)
  assert.ok(template.cells.some((cell) => cell.kind === 'water'))
  assert.ok(template.features.some((feature) => feature.semantic === 'water-bridge-flat'))
  assert.ok(template.features.some((feature) => feature.semantic === 'water-bridge-arch'))
  assert.equal(validateRoomTemplate(template).valid, true)
})

test('scenario builders cover empty, water, bridge and encounter combinations', () => {
  for (const scenario of ROOM_SCENARIOS) {
    const template = createRoomScenarioTemplate(scenario.key, { id: `scenario-${scenario.key}` })
    const result = validateRoomTemplate(template)
    assert.equal(result.valid, true, `${scenario.key}: ${result.valid ? '' : result.errors.map((error) => error.message).join('; ')}`)
    assert.equal(template.id, `scenario-${scenario.key}`)
    if (scenario.key !== 'empty') assert.ok(template.placements.length > 0, `${scenario.key} has no authored assets`)
  }
})

test('focused correction scenarios isolate the five structural questions', () => {
  assert.deepEqual(ROOM_SCENARIOS.slice(0, 5).map((scenario) => scenario.key), [
    'wall',
    'water',
    'door',
    'flat-bridge',
    'arch-bridge',
  ])
  const expectations = {
    wall: ['wall.vertical.west', 'wall.vertical.east', 'wall.horizontal'],
    water: ['water.body'],
    door: ['door.closed', 'door.open'],
    'flat-bridge': ['bridge.flat'],
    'arch-bridge': ['bridge.arch'],
  }
  for (const [scenario, assetsForScenario] of Object.entries(expectations)) {
    const template = createRoomScenarioTemplate(scenario, { id: `focused-${scenario}` })
    const placed = new Set(template.placements.map((placement) => placement.asset))
    for (const asset of assetsForScenario) assert.ok(placed.has(asset), `${scenario} missing ${asset}`)
  }
})

test('doorway scenario keeps authored 2x3 wall segments flush to both door frames', () => {
  const template = createRoomScenarioTemplate('door', { id: 'doorway-reference' })
  const placed = template.placements.map(({ asset, x, y, width, height }) => ({ asset, x, y, width, height }))
  const horizontal = placed.filter(entry => entry.asset === 'wall.horizontal')
  const doors = placed.filter(entry => entry.asset === 'door.closed' || entry.asset === 'door.open')

  assert.deepEqual(doors, [
    { asset: 'door.closed', x: 15, y: 2, width: 2, height: 3 },
    { asset: 'door.open', x: 15, y: 13, width: 2, height: 3 },
  ])
  for (const y of [2, 13]) {
    const row = horizontal.filter(entry => entry.y === y)
    assert.deepEqual(row.map(entry => entry.x), [3, 5, 7, 9, 11, 13, 17, 19, 21, 23, 25, 27])
    assert.ok(row.every(entry => entry.width === 2 && entry.height === 3))
  }
  assert.deepEqual(placed.filter(entry => entry.asset === 'wall.vertical.west').map(entry => [entry.x, entry.y, entry.width, entry.height]), [
    [2, 2, 1, 6], [2, 13, 1, 6],
  ])
  assert.deepEqual(placed.filter(entry => entry.asset === 'wall.vertical.east').map(entry => [entry.x, entry.y, entry.width, entry.height]), [
    [29, 2, 1, 6], [29, 13, 1, 6],
  ])
  assert.deepEqual(horizontal.filter(entry => [5, 16].includes(entry.y) && [0, 30].includes(entry.x)).map(entry => [entry.x, entry.y]), [
    [0, 5], [30, 5], [0, 16], [30, 16],
  ])
})

test('focused templates expose their unique assets for an on-canvas correction strip', () => {
  assert.deepEqual(getTemplateAssetKeys(createRoomScenarioTemplate('wall')), [
    'wall.horizontal',
    'wall.vertical.west',
    'wall.vertical.east',
    'wall.vertical.body',
  ])
  assert.deepEqual(getTemplateAssetKeys(createRoomScenarioTemplate('flat-bridge')), [
    'water.body',
    'assembly.waterLong',
    'bridge.flat',
    'wall.vertical.west',
    'wall.vertical.east',
    'door.closed',
  ])
})

test('selection moves complete authored placements and their semantic layer entries', () => {
  const state = createRoomEditorState(createEmptyRoomTemplate({ id: 'move', width: 12, height: 8 }))
  const placed = placeAsset(placeAsset(state, find('wall.vertical.west'), 1, 1), find('door.closed'), 5, 2)
  const ids = selectPlacementIds(placed.template, { x: 0, y: 0, width: 4, height: 4 })
  assert.deepEqual(ids, ['wall-vertical-west-1'])

  const moved = movePlacements(placed, ids, 2, 1)
  assert.equal(moved.errors.length, 0)
  assert.deepEqual(moved.template.placements.find((placement) => placement.id === ids[0]).x, 3)
  assert.deepEqual(moved.template.placements.find((placement) => placement.id === ids[0]).y, 2)
  assert.deepEqual(moved.template.walls.find((wall) => wall.id === ids[0]).x, 3)
  assert.deepEqual(moved.template.walls.find((wall) => wall.id === ids[0]).y, 2)
  assert.equal(moved.template.placements.find((placement) => placement.asset === 'door.closed').x, 5)
})

test('selection deletion removes placements and linked semantic entries without deleting floor cells', () => {
  const state = createRoomEditorState(createEmptyRoomTemplate({ id: 'delete', width: 12, height: 8 }))
  const placed = placeAsset(placeAsset(state, find('wall.vertical.west'), 1, 1), find('door.closed'), 5, 2)
  const ids = selectPlacementIds(placed.template, { x: 0, y: 0, width: 4, height: 4 })
  const deleted = deletePlacements(placed, ids)

  assert.equal(deleted.errors.length, 0)
  assert.equal(deleted.template.placements.length, 1)
  assert.equal(deleted.template.walls.length, 0)
  assert.equal(deleted.template.features.length, 1)
  assert.equal(deleted.template.cells.length, 12 * 8)
})

test('motif placement is atomic when the footprint is out of bounds', () => {
  const template = createEmptyRoomTemplate({ id: 'bounds', width: 4, height: 4 })
  const state = createRoomEditorState(template)
  const next = placeAsset(state, find('door.closed'), 3, 1)

  assert.ok(next.errors.length > 0)
  assert.deepEqual(next.template, state.template)
})

test('erase and water painting produce immutable semantic edits', () => {
  const template = createEmptyRoomTemplate({ id: 'water', width: 8, height: 8 })
  const initial = createRoomEditorState(template)
  const withWater = setCellKind(initial, 3, 3, 'water')
  const withBridge = placeAsset(withWater, find('bridge.flat'), 3, 3)
  assert.equal(withBridge.errors.length, 0)
  assert.equal(withBridge.template.cells.find((cell) => cell.x === 3 && cell.y === 3).kind, 'water')
  assert.equal(withBridge.template.placements.length, 1)

  const erased = eraseAt(withBridge, 3, 3)
  assert.equal(erased.errors.length, 0)
  assert.equal(erased.template.placements.length, 0)
  assert.equal(initial.template.placements.length, 0)
})

test('ports and explicit rotations preserve source flips and rotation metadata', () => {
  const template = createEmptyRoomTemplate({ id: 'ports', width: 12, height: 8 })
  const state = createRoomEditorState(template)
  const west = find('wall.vertical.west')
  const placed = placeAsset(state, west, 1, 1, { rotation: 0 })
  assert.equal(placed.errors.length, 0)
  assert.equal(placed.template.placements[0].rotation, 0)
  assert.deepEqual(placed.template.placements[0].source.cells.map((cell) => cell.source.flipX), west.cells.map((cell) => cell.flipX))

  const ported = placePort(placed, { id: 'east-door', edge: 'east', x: 11, y: 3, kind: 'door', level: 1, water: false })
  assert.equal(ported.errors.length, 0)
  assert.deepEqual(ported.template.ports[0], { id: 'east-door', edge: 'east', x: 11, y: 3, kind: 'door', level: 1, water: false })

  const invalid = placePort(ported, { id: 'bad-door', edge: 'north', x: 2, y: 0, kind: 'door', level: 1, targetLevel: 2, levelDelta: 1 })
  assert.ok(invalid.errors.length > 0)
  assert.equal(invalid.template.ports.length, 1)
})
