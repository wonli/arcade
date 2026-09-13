import test from 'node:test'
import assert from 'node:assert/strict'

import { DUNGEON_MUSIC_PATH, createDungeonAmbient } from './ambient.js'

class FakeAudio {
  constructor(src) {
    this.src = src
    this.loop = false
    this.volume = 1
    this.preload = ''
    this.currentTime = 0
    this.paused = true
    this.playCount = 0
  }

  async play() {
    this.playCount++
    this.paused = false
  }

  pause() {
    this.paused = true
  }
}

test('dungeon ambience uses the committed music track', async () => {
  let audio = null
  const windowImpl = {
    Audio: class extends FakeAudio {
      constructor(src) {
        super(src)
        audio = this
      }
    },
  }

  const ambient = createDungeonAmbient({ windowImpl })
  assert.equal(DUNGEON_MUSIC_PATH, '/assets/dungeon/m1.m4a')
  assert.equal(ambient.getState(), 'idle')

  await ambient.start()
  assert.equal(audio.src, DUNGEON_MUSIC_PATH)
  assert.equal(audio.loop, true)
  assert.equal(audio.preload, 'auto')
  assert.ok(audio.volume > 0 && audio.volume <= 1)
  assert.equal(audio.paused, false)
  assert.equal(ambient.getState(), 'running')

  ambient.stop()
  assert.equal(audio.paused, true)
  assert.equal(audio.currentTime, 0)
  assert.equal(ambient.getState(), 'closed')
})

test('closed ambience cannot be restarted by a late input callback', async () => {
  let audio = null
  const windowImpl = {
    Audio: class extends FakeAudio {
      constructor(src) {
        super(src)
        audio = this
      }
    },
  }
  const ambient = createDungeonAmbient({ windowImpl })
  await ambient.start()
  ambient.stop()
  await ambient.start()
  assert.equal(audio.playCount, 1)
  assert.equal(audio.paused, true)
  assert.equal(ambient.getState(), 'closed')
})

test('ambient reports unsupported without Audio', async () => {
  const ambient = createDungeonAmbient({ windowImpl: {} })
  await ambient.start()
  assert.equal(ambient.getState(), 'unsupported')
})