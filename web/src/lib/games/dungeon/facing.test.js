import test from 'node:test'
import assert from 'node:assert/strict'

import { playerFlipX } from './scene.js'

test('RPG side sprite faces the same horizontal direction as movement', () => {
  assert.equal(playerFlipX('left'), false)
  assert.equal(playerFlipX('right'), true)
  assert.equal(playerFlipX('up'), false)
  assert.equal(playerFlipX('down'), false)
})
