import test from 'node:test'
import assert from 'node:assert/strict'

import { describeDungeonAsset, describeRpgMainCharacterAsset } from './assets.js'

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

test('describes RPG main character idle and walk sheets as 64x64 cells', () => {
  assert.deepEqual(
    describeRpgMainCharacterAsset('/assets/rpg-main-character/_down walk.png', 256, 128),
    { frames: 8, frameWidth: 64, frameHeight: 64, action: 'walk', direction: 'down' },
  )
})

test('describes RPG main character attack sheets as 64x64 cells', () => {
  assert.deepEqual(
    describeRpgMainCharacterAsset('/assets/rpg-main-character/_side attack.png', 128, 128),
    { frames: 4, frameWidth: 64, frameHeight: 64, action: 'attack', direction: 'side' },
  )
})
