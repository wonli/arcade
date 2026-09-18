import { describe, expect, test } from 'vitest'
import { createTranslator } from '../i18n.js'
import { GAME_IDS, getLauncherMetadata } from './launcher-registry.js'

describe('launcher metadata registry', () => {
  test('returns metadata for every known game', () => {
    expect(GAME_IDS).toEqual(['gomoku', 'chess', 'tetris', 'snake', 'drawguess', 'dungeon'])
    for (const id of GAME_IDS) {
      const metadata = getLauncherMetadata(id)
      expect(metadata.id).toBe(id)
      expect(metadata.howToPlay.length).toBeGreaterThanOrEqual(2)
      expect(metadata.howToPlay.length).toBeLessThanOrEqual(4)
    }
  })

  test('returns a safe empty manifest for unknown games', () => {
    expect(getLauncherMetadata('missing')).toEqual({ id: '', howToPlay: [], controls: [], tip: '' })
  })

  test('preserves keyboard display tokens', () => {
    expect(getLauncherMetadata('tetris').controls.map((item) => item.keys)).toEqual([
      ['←', '→'],
      ['↓'],
      ['↑'],
      ['Space'],
    ])
    expect(getLauncherMetadata('snake').controls[0].keys).toEqual(['W', 'A', 'S', 'D'])
    expect(getLauncherMetadata('dungeon').controls.map((item) => item.keys)).toEqual([
      ['W', 'A', 'S', 'D'],
      ['Space'],
      ['E'],
    ])
  })

  test('all launcher copy resolves in English and Chinese', () => {
    for (const locale of ['en', 'zh-CN']) {
      const t = createTranslator(locale)
      for (const id of GAME_IDS) {
        const metadata = getLauncherMetadata(id)
        const keys = [
          ...metadata.howToPlay,
          ...metadata.controls.map((item) => item.label),
          ...(metadata.tip ? [metadata.tip] : []),
        ]
        for (const key of keys) {
          expect(t(key)).not.toBe(key)
          expect(t(key).trim()).not.toBe('')
        }
      }
    }
  })
})
