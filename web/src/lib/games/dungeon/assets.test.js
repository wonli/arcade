import test from 'node:test'
import assert from 'node:assert/strict'

import { describeDungeonAsset } from './assets.js'

test('describes the Debts wizard strip as four 26x18 animation frames', () => {
  assert.deepEqual(
    describeDungeonAsset('/assets/debts/Characters/Wizard.png', 182, 18),
    { frames: 4, frameWidth: 26, frameHeight: 18 },
  )
})

test('keeps regular four-frame creature sheets on their natural frame size', () => {
  assert.deepEqual(
    describeDungeonAsset('/assets/debts/Creatures/Slime.png', 64, 16),
    { frames: 4, frameWidth: 16, frameHeight: 16 },
  )
})
