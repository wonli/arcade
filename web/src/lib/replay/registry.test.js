import test from 'node:test'
import assert from 'node:assert/strict'
import { GAME_IDS } from '../games/launcher-registry.js'
import { getReplayAdapter } from './registry.js'

test('every launcher game provides a replay adapter contract', () => {
  for (const id of GAME_IDS) {
    const adapter = getReplayAdapter(id)
    assert.equal(adapter.id, id)
    assert.ok(adapter.version > 0)
    assert.equal(typeof adapter.createRecorder, 'function')
    assert.equal(typeof adapter.encode, 'function')
    assert.equal(typeof adapter.decode, 'function')
    assert.equal(typeof adapter.createPlayer, 'function')
  }
})

test('unknown games do not silently receive a generic adapter', () => {
  assert.equal(getReplayAdapter('unknown'), null)
})
