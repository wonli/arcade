import test from 'node:test'
import assert from 'node:assert/strict'

import { hitFeedback, knockbackTarget } from './hit-feedback.js'

test('critical feedback is stronger than normal feedback', () => {
  const normal = hitFeedback({ critical: false, boss: false, damage: 20 })
  const critical = hitFeedback({ critical: true, boss: false, damage: 40 })
  assert.ok(critical.hitStopMs > normal.hitStopMs)
  assert.ok(critical.shake > normal.shake)
  assert.ok(critical.flashMs >= normal.flashMs)
})

test('bosses receive reduced hit stop and knockback scale', () => {
  const normal = hitFeedback({ critical: true, boss: false, damage: 40 })
  const boss = hitFeedback({ critical: true, boss: true, damage: 40 })
  assert.ok(boss.hitStopMs < normal.hitStopMs)
  assert.ok(boss.knockbackScale < normal.knockbackScale)
})

test('knockback cannot push a target through solid geometry', () => {
  const geometry = { solids: [{ x: 150, y: 80, width: 40, height: 80 }], water: [] }
  const target = { x: 130, y: 120, hitRadius: 14 }
  const next = knockbackTarget(target, { x: 80, y: 120 }, 80, geometry)
  assert.ok(next.x < 136)
  assert.equal(next.y, 120)
})
