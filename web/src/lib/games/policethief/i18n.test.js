import test from 'node:test'
import assert from 'node:assert/strict'

import { createPoliceThiefTranslator, policeThiefStatusKey } from './i18n.js'

const fallback = (key) => `fallback:${key}`

test('police thief translations provide English and Chinese game copy', () => {
  assert.equal(createPoliceThiefTranslator('en', fallback)('game.policethief.name'), 'Police & Thief')
  assert.equal(createPoliceThiefTranslator('zh-CN', fallback)('game.policethief.name'), '警察抓小偷')
  assert.equal(createPoliceThiefTranslator('zh-CN', fallback)('policethief.role.police'), '警察')
})

test('police thief translator falls back to shared translations', () => {
  assert.equal(createPoliceThiefTranslator('en', fallback)('common.roomCode'), 'fallback:common.roomCode')
})


test('police thief playing status ignores room occupancy and follows the active role', () => {
  assert.equal(policeThiefStatusKey({
    status: 'playing',
    turn: 'police',
    localRole: 'thief',
    botRole: 'police',
    hasOpponent: false,
  }), 'room.botTurn')
})

test('police thief status distinguishes local, human opponent, and bot turns', () => {
  assert.equal(policeThiefStatusKey({ status: 'playing', turn: 'thief', localRole: 'thief', botRole: 'police' }), 'policethief.yourTurn')
  assert.equal(policeThiefStatusKey({ status: 'playing', turn: 'police', localRole: 'thief' }), 'policethief.opponentTurn')
  assert.equal(policeThiefStatusKey({ status: 'playing', turn: 'police', localRole: 'thief', botRole: 'police' }), 'room.botTurn')
})

test('police thief non-playing status keeps waiting and preparing states', () => {
  assert.equal(policeThiefStatusKey({ hasOpponent: false }), 'policethief.waiting')
  assert.equal(policeThiefStatusKey({ hasOpponent: true }), 'room.preparing')
})
