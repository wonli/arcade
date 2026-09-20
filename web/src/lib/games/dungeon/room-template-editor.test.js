import test from 'node:test'
import assert from 'node:assert/strict'

import { createEmptyRoomTemplate } from './room-template.js'
import { listDungeon3RoomAssets } from './room-template-assets.js'
import {
  createRoomEditorState,
  eraseAt,
  placeAsset,
  placePort,
  setCellKind,
} from './room-template-editor.js'

const assets = listDungeon3RoomAssets()
const find = (key) => assets.find((asset) => asset.key === key)

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
