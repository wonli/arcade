import test from 'node:test'
import assert from 'node:assert/strict'

import { elitePresentation, hitSoundProfile, lootMotion, roomClearFeedback } from './combat-feel.js'

test('critical and kill impacts sound heavier than normal hits', () => {
  const normal = hitSoundProfile({ damage: 18 })
  const critical = hitSoundProfile({ damage: 36, critical: true })
  const kill = hitSoundProfile({ damage: 36, killed: true })
  assert.ok(critical.gain > normal.gain)
  assert.ok(critical.duration >= normal.duration)
  assert.ok(kill.lowFrequency < normal.lowFrequency)
  assert.ok(kill.duration > normal.duration)
})

test('elite kills sound heavier than regular kills', () => {
  const normal = hitSoundProfile({ damage: 36, killed: true })
  const elite = hitSoundProfile({ damage: 36, killed: true, elite: true })
  assert.ok(elite.gain > normal.gain)
  assert.ok(elite.duration > normal.duration)
  assert.ok(elite.lowFrequency <= normal.lowFrequency)
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

test('elite presentation is visibly stronger without changing combat stats', () => {
  const elite = elitePresentation({ boss: false })
  assert.ok(elite.scale > 1)
  assert.ok(elite.auraRadius >= 24)
  assert.ok(elite.pulseMs >= 500)
  assert.equal(elite.hpMultiplier, 1)
  assert.equal(elite.damageMultiplier, 1)
})

test('room clear feedback is stronger after elite encounters', () => {
  const normal = roomClearFeedback({ roomRole: 'combat' })
  const elite = roomClearFeedback({ roomRole: 'elite' })
  assert.ok(normal.hitStopMs >= 50)
  assert.ok(elite.shake > normal.shake)
  assert.ok(elite.soundGain > normal.soundGain)
  assert.ok(elite.ringRadius > normal.ringRadius)
})
