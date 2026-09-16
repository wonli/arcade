import { attachLegacyTestPlayer } from './test/player-fixture.js'
import test from 'node:test'
import assert from 'node:assert/strict'
import { installDungeonEnemyBehaviors } from './enemy-behavior-runtime.js'
import { createPlayerEntity } from './player-entity.js'

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
  const { scene } = makeScene(); const runtime = installDungeonEnemyBehaviors(attachLegacyTestPlayer(scene))
  const enemy = { archetype: 'fast', x: 0, y: 100, speed: 50, hp: 10, nextSpecialAt: 0 }
  runtime.update(enemy, 1000, 0.016)
  assert.ok(enemy.dashUntil > 1000); assert.ok(enemy.nextSpecialAt > enemy.dashUntil); assert.ok(enemy.dashVx > 50)
})

test('brute slam settles from gameplay time without a Phaser delayed callback', () => {
  const { scene, hits, timers } = makeScene(); const runtime = installDungeonEnemyBehaviors(attachLegacyTestPlayer(scene))
  const enemy = { archetype: 'brute', x: 40, y: 100, speed: 30, hp: 20, contactDamage: 14, nextSpecialAt: 0 }

  runtime.update(enemy, 1000, 0.016)

  assert.equal(timers.length, 0)
  assert.equal(hits.length, 0)
  assert.equal(enemy.pendingSpecial?.type, 'brute_slam')
  assert.equal(enemy.pendingSpecial?.resolveAt, 1420)

  runtime.update(enemy, 1419, 0.016)
  assert.equal(hits.length, 0)

  runtime.update(enemy, 1420, 0.016)
  assert.deepEqual(hits, [18])
  assert.equal(enemy.pendingSpecial, null)

  runtime.update(enemy, 1421, 0.016)
  assert.deepEqual(hits, [18])
})

test('brute slam misses when its locked target leaves the telegraphed radius', () => {
  const { scene, hits } = makeScene(); const runtime = installDungeonEnemyBehaviors(attachLegacyTestPlayer(scene))
  const enemy = { archetype: 'brute', x: 40, y: 100, speed: 30, hp: 20, contactDamage: 14, nextSpecialAt: 0 }

  runtime.update(enemy, 1000, 0.016)
  scene.localPlayer.state.x = 400
  runtime.update(enemy, 1420, 0.016)

  assert.deepEqual(hits, [])
  assert.equal(enemy.pendingSpecial, null)
})

test('brute slam is cancelled when the enemy dies during windup', () => {
  const { scene, hits } = makeScene(); const runtime = installDungeonEnemyBehaviors(attachLegacyTestPlayer(scene))
  const enemy = { archetype: 'brute', x: 40, y: 100, speed: 30, hp: 20, contactDamage: 14, nextSpecialAt: 0 }

  runtime.update(enemy, 1000, 0.016)
  enemy.hp = 0
  runtime.update(enemy, 1420, 0.016)

  assert.deepEqual(hits, [])
  assert.equal(enemy.pendingSpecial, null)
})

test('skeleton close pressure uses lateral movement', () => {
  const { scene } = makeScene(); const runtime = installDungeonEnemyBehaviors(attachLegacyTestPlayer(scene))
  const enemy = { archetype: 'skeleton', x: 45, y: 100, speed: 50, hp: 10, strafeSign: 1 }
  runtime.update(enemy, 1000, 0.1)
  assert.notEqual(enemy.y, 100)
})

test('enemy routing chooses the nearest living registered player when local target is only the fallback', () => {
  const { scene } = makeScene()
  attachLegacyTestPlayer(scene)
  const local = scene.localPlayer
  const remote = createPlayerEntity({ id: 'remote', state: { x: 10, y: 0, hp: 100, maxHp: 100 } })
  scene.players = new Map([[local.id, local], [remote.id, remote]])

  let resolvedTarget = null
  scene.moveEnemyTowardPlayer = (_enemy, _time, _dt, target) => { resolvedTarget = target }
  installDungeonEnemyBehaviors(scene)

  scene.moveEnemyTowardPlayer({ boss: true, x: 0, y: 0, hp: 100 }, 1000, 0.016, local)

  assert.equal(resolvedTarget, remote)
})
