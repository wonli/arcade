import test from 'node:test'
import assert from 'node:assert/strict'
import { createTranslator } from '../i18n.js'
import { createPoliceThiefTranslator } from './policethief/i18n.js'
import { createXiangqiTranslator } from './xiangqi/i18n.js'
import { GAME_IDS, getLauncherMetadata } from './launcher-registry.js'

const expectedGames = ['gomoku', 'chess', 'xiangqi', 'tetris', 'snake', 'drawguess', 'dungeon', 'policethief']

function translator(locale) {
  return createXiangqiTranslator(locale, createPoliceThiefTranslator(locale, createTranslator(locale)))
}

test('launcher registry returns metadata for every known game', () => {
  assert.deepEqual(GAME_IDS, expectedGames)
  for (const id of GAME_IDS) {
    const metadata = getLauncherMetadata(id)
    assert.equal(metadata.id, id)
    assert.ok(metadata.howToPlay.length >= 2)
    assert.ok(metadata.howToPlay.length <= 4)
  }
})

test('launcher registry returns a safe empty manifest for unknown games', () => {
  assert.deepEqual(getLauncherMetadata('missing'), { id: '', howToPlay: [], controls: [], tip: '' })
})

test('launcher registry preserves keyboard display tokens', () => {
  assert.deepEqual(getLauncherMetadata('tetris').controls.map((item) => item.keys), [
    ['←', '→'],
    ['↓'],
    ['↑'],
    ['Space'],
  ])
  assert.deepEqual(getLauncherMetadata('snake').controls[0].keys, ['W', 'A', 'S', 'D'])
  assert.deepEqual(getLauncherMetadata('dungeon').controls.map((item) => item.keys), [
    ['W', 'A', 'S', 'D'],
    ['Space'],
    ['E'],
  ])
})

test('all launcher copy resolves in English and Chinese', () => {
  for (const locale of ['en', 'zh-CN']) {
    const t = translator(locale)
    for (const id of GAME_IDS) {
      const metadata = getLauncherMetadata(id)
      const keys = [
        ...metadata.howToPlay,
        ...metadata.controls.map((item) => item.label),
        ...(metadata.tip ? [metadata.tip] : []),
      ]
      for (const key of keys) {
        assert.notEqual(t(key), key)
        assert.notEqual(t(key).trim(), '')
      }
    }
  }
})
