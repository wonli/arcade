import test from 'node:test'
import assert from 'node:assert/strict'

import { createDungeonAmbient } from './ambient.js'
import { DUNGEON_BGM } from './music.js'

test('dungeon bgm is a 48 second loop with musical layers', () => {
  assert.equal(DUNGEON_BGM.duration, 48)
  assert.equal(DUNGEON_BGM.bpm, 80)
  assert.ok(DUNGEON_BGM.bass.length >= 16)
  assert.ok(DUNGEON_BGM.melody.length >= 20)
  assert.ok(DUNGEON_BGM.pulses.length >= 24)
  assert.equal(DUNGEON_BGM.loopBeats, 64)
})

class FakeParam {
  constructor() { this.value = 0 }
  setValueAtTime(value) { this.value = value }
  exponentialRampToValueAtTime(value) { this.value = value }
}

class FakeNode {
  connect() {}
}

class FakeOscillator extends FakeNode {
  constructor(log) {
    super()
    this.log = log
    this.frequency = new FakeParam()
    this.type = 'sine'
  }
  start(when = 0) { this.log.push({ frequency: this.frequency.value, when, type: this.type }) }
  stop() {}
}

class FakeGain extends FakeNode {
  constructor() {
    super()
    this.gain = new FakeParam()
  }
}

class FakeAudioContext {
  constructor(log) {
    this.log = log
    this.state = 'suspended'
    this.currentTime = 0
    this.destination = {}
  }
  createOscillator() { return new FakeOscillator(this.log) }
  createGain() { return new FakeGain() }
  async resume() { this.state = 'running' }
  async close() { this.state = 'closed' }
}

test('ambient resumes audio and schedules an audible musical loop', async () => {
  const notes = []
  const windowImpl = {
    AudioContext: class extends FakeAudioContext { constructor() { super(notes) } },
    setTimeout() { return 1 },
    clearTimeout() {},
  }
  const ambient = createDungeonAmbient({ windowImpl })
  assert.equal(ambient.getState(), 'idle')
  await ambient.start()
  assert.equal(ambient.getState(), 'running')
  assert.ok(notes.length >= 40)
  assert.ok(notes.some((note) => note.frequency >= 220))
  assert.ok(notes.some((note) => note.type === 'square'))
  ambient.stop()
  assert.equal(ambient.getState(), 'closed')
})

test('ambient reports unsupported without AudioContext', async () => {
  const ambient = createDungeonAmbient({ windowImpl: {} })
  await ambient.start()
  assert.equal(ambient.getState(), 'unsupported')
})
