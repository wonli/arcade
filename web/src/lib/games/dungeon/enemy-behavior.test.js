import test from 'node:test'
import assert from 'node:assert/strict'
import { enemyBehaviorProfile, enemyBehaviorStep } from './enemy-behavior.js'

test('enemy archetypes have distinct tactical identities', () => {
  const skeleton = enemyBehaviorProfile('skeleton')
  const fast = enemyBehaviorProfile('fast')
  const brute = enemyBehaviorProfile('brute')
  const ranged = enemyBehaviorProfile('ranged')
  assert.equal(skeleton.mode, 'pressure')
  assert.equal(fast.mode, 'dash')
  assert.equal(brute.mode, 'windup')
  assert.equal(ranged.mode, 'kite')
  assert.ok(fast.dashSpeedMultiplier > 1)
  assert.ok(brute.windupMs >= 300)
  assert.ok(ranged.strafeMultiplier > 0)
})

test('fast enemy alternates between approach and committed dash', () => {
  const waiting = enemyBehaviorStep({ archetype: 'fast', nextSpecialAt: 1200 }, { distance: 150, time: 1000 })
  const dash = enemyBehaviorStep({ archetype: 'fast', nextSpecialAt: 900 }, { distance: 150, time: 1000 })
  assert.equal(waiting.action, 'approach')
  assert.equal(dash.action, 'dash')
  assert.ok(dash.durationMs > 0)
})

test('brute telegraphs a slam before its active hit window', () => {
  const windup = enemyBehaviorStep({ archetype: 'brute', nextSpecialAt: 900 }, { distance: 92, time: 1000 })
  const far = enemyBehaviorStep({ archetype: 'brute', nextSpecialAt: 900 }, { distance: 180, time: 1000 })
  assert.equal(windup.action, 'slam-windup')
  assert.equal(far.action, 'approach')
  assert.ok(windup.radius >= 70)
})

test('skeleton sidesteps at close range instead of behaving like fast enemy', () => {
  const close = enemyBehaviorStep({ archetype: 'skeleton', strafeSign: 1 }, { distance: 58, time: 1000 })
  const far = enemyBehaviorStep({ archetype: 'skeleton', strafeSign: 1 }, { distance: 150, time: 1000 })
  assert.equal(close.action, 'sidestep')
  assert.equal(far.action, 'approach')
})
