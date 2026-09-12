import test from 'node:test'
import assert from 'node:assert/strict'

import { hitSoundProfile, lootMotion } from './combat-feel.js'

test('critical and kill impacts sound heavier than normal hits', () => {
  const normal = hitSoundProfile({ damage: 18 })
  const critical = hitSoundProfile({ damage: 36, critical: true })
  const kill = hitSoundProfile({ damage: 36, killed: true })
  assert.ok(critical.gain > normal.gain)
  assert.ok(critical.duration >= normal.duration)
  assert.ok(kill.lowFrequency < normal.lowFrequency)
  assert.ok(kill.duration > normal.duration)
})

test('loot motion bounces first then settles into a subtle hover', () => {
  const fresh = lootMotion(0, 120, 80)
  const landing = lootMotion(360, 120, 80)
  const settled = lootMotion(900, 120, 80)
  assert.ok(fresh.y < 120)
  assert.ok(landing.scale >= 1)
  assert.ok(Math.abs(settled.y - 120) <= 5)
  assert.ok(settled.scale > 0.95 && settled.scale < 1.05)
})
