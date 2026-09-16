import test from 'node:test'
import assert from 'node:assert/strict'
import { createTranslator, normalizeLocale, readStoredLocale } from './i18n.js'

test('locale defaults to English and normalizes Chinese variants', () => {
  assert.equal(normalizeLocale(), 'en')
  assert.equal(normalizeLocale('fr-FR'), 'en')
  assert.equal(normalizeLocale('zh'), 'zh-CN')
  assert.equal(normalizeLocale('zh-TW'), 'zh-CN')
})

test('translator falls back to English for missing Chinese keys', () => {
  const t = createTranslator('zh-CN', {
    en: { greeting: 'Hello', onlyEnglish: 'Fallback' },
    'zh-CN': { greeting: '你好' },
  })
  assert.equal(t('greeting'), '你好')
  assert.equal(t('onlyEnglish'), 'Fallback')
  assert.equal(t('missing'), 'missing')
})

test('translator interpolates values', () => {
  const t = createTranslator('en', { en: { players: '{count} players' }, 'zh-CN': {} })
  assert.equal(t('players', { count: 4 }), '4 players')
})

test('stored locale remains English when storage is empty or invalid', () => {
  const empty = { getItem: () => null }
  const chinese = { getItem: () => 'zh-TW' }
  assert.equal(readStoredLocale(empty), 'en')
  assert.equal(readStoredLocale(chinese), 'zh-CN')
})
