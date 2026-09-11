import test from 'node:test'
import assert from 'node:assert/strict'

import { createDungeonAmbient } from './ambient.js'

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
  start() { this.log.push(this.frequency.value) }
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

test('ambient resumes audio and uses speaker-audible persistent frequencies', async () => {
  const frequencies = []
  const windowImpl = {
    AudioContext: class extends FakeAudioContext { constructor() { super(frequencies) } },
    setInterval() { return 1 },
    clearInterval() {},
  }
  const ambient = createDungeonAmbient({ windowImpl, random: () => 0.5 })
  assert.equal(ambient.getState(), 'idle')
  await ambient.start()
  assert.equal(ambient.getState(), 'running')
  assert.ok(frequencies.length >= 2)
  assert.ok(frequencies.slice(0, 2).every((frequency) => frequency >= 90))
  ambient.stop()
  assert.equal(ambient.getState(), 'closed')
})

test('ambient reports unsupported without AudioContext', async () => {
  const ambient = createDungeonAmbient({ windowImpl: {} })
  await ambient.start()
  assert.equal(ambient.getState(), 'unsupported')
})
