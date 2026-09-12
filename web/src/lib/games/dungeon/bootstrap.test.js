import test from 'node:test'
import assert from 'node:assert/strict'

import { dungeonSceneReady } from './bootstrap.js'

test('does not install co-op runtime until the Dungeon scene create phase has made its player state', () => {
  assert.equal(dungeonSceneReady({}), false)
  assert.equal(dungeonSceneReady({ player: {}, playerState: {}, playerBar: {}, keys: {} }), true)
})
