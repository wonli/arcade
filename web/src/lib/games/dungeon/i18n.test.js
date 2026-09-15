import test from 'node:test'
import assert from 'node:assert/strict'

import {
  createDungeonTranslator,
  dungeonHudLabels,
  normalizeDungeonLocale,
} from './i18n.js'

test('dungeon locale normalizes Chinese browser variants to the shared Chinese catalog', () => {
  assert.equal(normalizeDungeonLocale('zh-TW'), 'zh-CN')
  assert.equal(normalizeDungeonLocale('zh-Hant-TW'), 'zh-CN')
  assert.equal(normalizeDungeonLocale('en-US'), 'en')
})

test('shared translator interpolates coop labels and falls back to English keys', () => {
  const zh = createDungeonTranslator('zh-TW')
  const en = createDungeonTranslator('en-US')

  assert.equal(zh('waitingPlayer', { room: 'abc123' }), '等待玩家 · 分享 abc123')
  assert.equal(en('waitingPlayer', { room: 'abc123' }), 'WAITING FOR PLAYER · SHARE abc123')
  assert.equal(zh('missing-key'), 'missing-key')
})

test('HUD labels come from the same locale catalog used by the route', () => {
  const zh = dungeonHudLabels('zh-CN')
  const en = dungeonHudLabels('en')

  assert.equal(zh.locale, 'zh-CN')
  assert.equal(zh.hp, '生命')
  assert.equal(zh['rarity:legendary'], '传奇')
  assert.equal(en.locale, 'en')
  assert.equal(en.details, 'Stats')
  assert.equal(en['rarity:legendary'], 'Legendary')
})
