import test from 'node:test'
import assert from 'node:assert/strict'

import { buildPoliceThiefRoomPath, normalizePoliceThiefRole } from './setup.js'

test('police thief setup keeps host role in the new-room URL', () => {
  assert.equal(buildPoliceThiefRoomPath({ players: 1, role: 'police' }), '/room/new/policethief?players=1&role=police')
  assert.equal(buildPoliceThiefRoomPath({ players: 2, role: 'thief' }), '/room/new/policethief?players=2&role=thief')
})

test('police thief role normalization defaults to thief', () => {
  assert.equal(normalizePoliceThiefRole('police'), 'police')
  assert.equal(normalizePoliceThiefRole('thief'), 'thief')
  assert.equal(normalizePoliceThiefRole('anything'), 'thief')
})
