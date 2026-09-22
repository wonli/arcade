import test from 'node:test'
import assert from 'node:assert/strict'

import { createPoliceThiefTranslator } from './i18n.js'

const fallback = (key) => `fallback:${key}`

test('police thief translations provide English and Chinese game copy', () => {
  assert.equal(createPoliceThiefTranslator('en', fallback)('game.policethief.name'), 'Police & Thief')
  assert.equal(createPoliceThiefTranslator('zh-CN', fallback)('game.policethief.name'), '警察抓小偷')
  assert.equal(createPoliceThiefTranslator('zh-CN', fallback)('policethief.role.police'), '警察')
})

test('police thief translator falls back to shared translations', () => {
  assert.equal(createPoliceThiefTranslator('en', fallback)('common.roomCode'), 'fallback:common.roomCode')
})
