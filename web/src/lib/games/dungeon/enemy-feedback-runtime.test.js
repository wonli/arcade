import test from 'node:test'
import assert from 'node:assert/strict'

import {
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

test('runtime hit reaction moves only the visual, not authoritative enemy coordinates', () => {
  let tween = null
  const visual = { x: 120, y: 100, scaleX: 2, scaleY: 2, setPosition(x, y) { this.x = x; this.y = y; return this }, setScale(x, y) { this.scaleX = x; this.scaleY = y; return this } }
  const scene = { tweens: { add(config) { tween = config; return config } }, events: { once() {} } }
  const enemy = { x: 120, y: 100, visual }
  installDungeonEnemyFeedback(scene).hit(enemy, { x: 100, y: 100 }, { damage: 30 })
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
  installDungeonEnemyFeedback(scene).death(enemy)
  assert.equal(visual.visible, true)
  assert.equal(tween.alpha, 0)
  assert.ok(tween.duration >= 180 && tween.duration <= 300)
  assert.ok(tween.scaleX < visual.scaleX)
})

test('boss wrappers add bounded warnings and delegate gameplay exactly once', () => {
  let chargeCalls = 0
  let shockwaveCalls = 0
  const shapes = []
  const shape = () => ({ setOrigin() { return this }, setRotation() { return this }, setDepth() { return this }, setStrokeStyle() { return this }, destroy() { this.destroyed = true } })
  const scene = {
    playerState: { x: 240, y: 180 },
    bossCharge() { chargeCalls++ },
    bossShockwave() { shockwaveCalls++ },
    add: {
      rectangle() { const value = shape(); shapes.push(value); return value },
      circle() { const value = shape(); shapes.push(value); return value },
    },
    tweens: { add() {} },
    events: { once() {} },
  }
  const runtime = installDungeonEnemyFeedback(scene)
  const enemy = { x: 100, y: 100, phase: 2 }
  scene.bossCharge(enemy)
  assert.equal(chargeCalls, 1)
  assert.equal(shapes.length, 2)
  scene.bossShockwave(enemy)
  assert.equal(shockwaveCalls, 1)
  assert.equal(shapes.length, 5)
  runtime.restore()
})
