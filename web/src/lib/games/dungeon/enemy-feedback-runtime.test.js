import { attachLegacyTestPlayer } from './test/player-fixture.js'
import test from 'node:test'
import assert from 'node:assert/strict'

import {
  bossActionProfile,
  bossPlayerHitProfile,
  bossTelegraphProfile,
  enemyDeathProfile,
  enemyHitProfile,
  installDungeonEnemyFeedback,
} from './enemy-feedback-runtime.js'

test('hit recoil stays readable while bosses resist visual displacement', () => {
  const normal = enemyHitProfile({ damage: 24 })
  const critical = enemyHitProfile({ damage: 48, critical: true })
  const boss = enemyHitProfile({ damage: 48, critical: true, boss: true })
  assert.ok(critical.recoilPx > normal.recoilPx)
  assert.ok(boss.recoilPx < critical.recoilPx)
  assert.ok(normal.durationMs <= 140)
})

test('death presentation scales from normal to elite to boss without lingering', () => {
  const normal = enemyDeathProfile()
  const elite = enemyDeathProfile({ elite: true })
  const boss = enemyDeathProfile({ boss: true })
  assert.ok(elite.durationMs > normal.durationMs)
  assert.ok(boss.durationMs >= elite.durationMs)
  assert.ok(boss.durationMs <= 300)
  assert.ok(normal.endScale < 1)
})

test('boss telegraphs preserve existing windup timings and bounded shape counts', () => {
  const charge = bossTelegraphProfile('charge', { phase: 1 })
  const shockwave = bossTelegraphProfile('shockwave', { phase: 2 })
  assert.equal(charge.windupMs, 420)
  assert.equal(charge.shapeCount, 2)
  assert.equal(shockwave.windupMs, 560)
  assert.equal(shockwave.shapeCount, 3)
  assert.equal(shockwave.radius, 130)
})

test('boss action profiles synchronize poses to existing gameplay timings', () => {
  const charge = bossActionProfile('charge', { phase: 2 })
  const shockwave = bossActionProfile('shockwave', { phase: 1 })
  const phaseTwo = bossActionProfile('phase-two', { phase: 2 })
  assert.equal(charge.windupMs, 420)
  assert.equal(shockwave.windupMs, 560)
  assert.ok(charge.releaseScaleX > 1)
  assert.ok(shockwave.gatherScale < 1.2)
  assert.ok(phaseTwo.durationMs <= 320)
})

test('boss player hit feedback is stronger but capped', () => {
  const light = bossPlayerHitProfile({ damage: 18 })
  const heavy = bossPlayerHitProfile({ damage: 40 })
  assert.ok(heavy.shake >= light.shake)
  assert.ok(heavy.shake <= 0.012)
  assert.ok(heavy.flashMs <= 150)
})

test('runtime hit reaction moves only the visual, not authoritative enemy coordinates', () => {
  let tween = null
  const visual = { x: 120, y: 100, scaleX: 2, scaleY: 2, setPosition(x, y) { this.x = x; this.y = y; return this }, setScale(x, y) { this.scaleX = x; this.scaleY = y; return this } }
  const scene = { tweens: { add(config) { tween = config; return config } }, events: { once() {} } }
  const enemy = { x: 120, y: 100, visual }
  installDungeonEnemyFeedback(attachLegacyTestPlayer(scene)).hit(enemy, { x: 100, y: 100 }, { damage: 30 })
  assert.equal(enemy.x, 120)
  assert.equal(enemy.y, 100)
  assert.ok(tween.x > enemy.x)
  assert.equal(tween.y, enemy.y)
})

test('death keeps sprite visible while scheduling bounded fade and shrink', () => {
  let tween = null
  const visual = { visible: false, scaleX: 2, scaleY: 2, setVisible(value) { this.visible = value; return this } }
  const scene = { tweens: { add(config) { tween = config; return config } }, events: { once() {} } }
  const enemy = { x: 120, y: 100, visual, elite: false, boss: false }
  installDungeonEnemyFeedback(attachLegacyTestPlayer(scene)).death(enemy)
  assert.equal(visual.visible, true)
  assert.equal(tween.alpha, 0)
  assert.ok(tween.duration >= 180 && tween.duration <= 300)
  assert.ok(tween.scaleX < visual.scaleX)
})

test('boss wrappers add bounded warnings and delegate gameplay exactly once', () => {
  let chargeCalls = 0
  let shockwaveCalls = 0
  const shapes = []
  const tweens = []
  const shape = () => ({ setOrigin() { return this }, setRotation() { return this }, setDepth() { return this }, setStrokeStyle() { return this }, destroy() { this.destroyed = true } })
  const scene = {
    playerState: { x: 240, y: 180 },
    bossCharge() { chargeCalls++ },
    bossShockwave() { shockwaveCalls++ },
    add: {
      rectangle() { const value = shape(); shapes.push(value); return value },
      circle() { const value = shape(); shapes.push(value); return value },
    },
    tweens: { add(config) { tweens.push(config) } },
    time: { delayedCall() {} },
    events: { once() {} },
  }
  const runtime = installDungeonEnemyFeedback(attachLegacyTestPlayer(scene))
  const visual = { scaleX: 2, scaleY: 2, x: 100, y: 100, setScale() { return this }, setPosition() { return this } }
  const enemy = { x: 100, y: 100, phase: 2, hp: 100, nextChargeAt: 99, nextShockwaveAt: 88, visual }
  scene.bossCharge(enemy)
  assert.equal(chargeCalls, 1)
  assert.equal(shapes.length, 2)
  assert.equal(enemy.nextChargeAt, 99)
  scene.bossShockwave(enemy)
  assert.equal(shockwaveCalls, 1)
  assert.equal(shapes.length, 5)
  assert.equal(enemy.nextShockwaveAt, 88)
  assert.ok(tweens.some((config) => config.targets === visual))
  runtime.restore()
})

test('phase two and boss player-hit presentation do not mutate gameplay state', () => {
  const tweens = []
  const circles = []
  const scene = {
    add: { circle() { const value = { setStrokeStyle() { return this }, setDepth() { return this }, destroy() {} }; circles.push(value); return value } },
    tweens: { add(config) { tweens.push(config) } },
    cameras: { main: { shake(ms, strength) { this.lastShake = { ms, strength } } } },
    events: { once() {} },
  }
  const visual = { scaleX: 2, scaleY: 2 }
  const enemy = { hp: 100, maxHp: 100, phase: 2, nextChargeAt: 500, x: 120, y: 90, visual }
  const runtime = installDungeonEnemyFeedback(attachLegacyTestPlayer(scene))
  runtime.phaseTwo(enemy)
  runtime.playerHit({ boss: true, damage: 24, x: 120, y: 90 })
  assert.equal(enemy.hp, 100)
  assert.equal(enemy.nextChargeAt, 500)
  assert.ok(circles.length <= 2)
  assert.ok(tweens.length >= 1)
  assert.ok(scene.cameras.main.lastShake.strength <= 0.012)
})
