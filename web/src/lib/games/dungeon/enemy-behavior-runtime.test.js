import test from 'node:test'
import assert from 'node:assert/strict'
import { installDungeonEnemyBehaviors } from './enemy-behavior-runtime.js'

function makeScene() {
  const hits = [], tweens = [], timers = []
  const scene = {
    playerState: { x: 100, y: 100 },
    dead: false,
    time: { now: 1000, delayedCall(ms, fn) { timers.push({ ms, fn }) } },
    events: { once() {} },
    add: { circle() { return { setStrokeStyle() { return this }, setDepth() { return this }, destroy() {} } } },
    tweens: { add(config) { tweens.push(config) } },
    hitPlayer(damage) { hits.push(damage) },
    syncEnemyVisual() {},
    moveEnemyTowardPlayer(enemy, time, dt) { enemy.x += dt * 10 },
  }
  return { scene, hits, tweens, timers }
}

test('fast enemy commits to a bounded dash and schedules cooldown', () => {
  const { scene } = makeScene(); const runtime = installDungeonEnemyBehaviors(scene)
  const enemy = { archetype: 'fast', x: 0, y: 100, speed: 50, hp: 10, nextSpecialAt: 0 }
  runtime.update(enemy, 1000, 0.016)
  assert.ok(enemy.dashUntil > 1000); assert.ok(enemy.nextSpecialAt > enemy.dashUntil); assert.ok(enemy.dashVx > 50)
})

test('brute slam telegraphs then damages only if player remains in radius', () => {
  const { scene, hits, timers } = makeScene(); const runtime = installDungeonEnemyBehaviors(scene)
  const enemy = { archetype: 'brute', x: 40, y: 100, speed: 30, hp: 20, contactDamage: 14, nextSpecialAt: 0 }
  runtime.update(enemy, 1000, 0.016)
  assert.equal(timers.length, 1); assert.equal(hits.length, 0)
  timers[0].fn(); assert.equal(hits.length, 1)
})

test('skeleton close pressure uses lateral movement', () => {
  const { scene } = makeScene(); const runtime = installDungeonEnemyBehaviors(scene)
  const enemy = { archetype: 'skeleton', x: 45, y: 100, speed: 50, hp: 10, strafeSign: 1 }
  runtime.update(enemy, 1000, 0.1)
  assert.notEqual(enemy.y, 100)
})
