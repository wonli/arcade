import test from 'node:test'
import assert from 'node:assert/strict'

import { createPlayerEntity } from './player-entity.js'
import { installDungeonEnemyFeedback } from './enemy-feedback-runtime.js'

function player(id, x, y) {
  return createPlayerEntity({ id, state: { x, y, hp: 100, maxHp: 100, effects: {} } })
}

test('enemy feedback keeps boss target bound to the explicit PlayerEntity', () => {
  const local = player('local', 0, 100)
  const target = player('target', 200, 100)
  let delegated = null
  const tweens = []
  const shape = () => ({
    setOrigin() { return this },
    setRotation() { return this },
    setDepth() { return this },
    setStrokeStyle() { return this },
    destroy() {},
  })
  const scene = {
    localPlayer: local,
    bossCharge(enemy, provided) { delegated = provided },
    moveEnemyTowardPlayer() {},
    add: {
      rectangle() { return shape() },
      circle() { return shape() },
    },
    tweens: { add(config) { tweens.push(config); return config } },
    time: { delayedCall() {} },
    events: { once() {} },
  }
  const visual = {
    scaleX: 1,
    scaleY: 1,
    active: true,
    setPosition() { return this },
    setScale() { return this },
  }
  const enemy = { x: 100, y: 100, phase: 2, hp: 100, visual }

  installDungeonEnemyFeedback(scene, { player: target })
  scene.bossCharge(enemy, target)

  assert.equal(delegated, target)
  const pose = tweens.find((config) => config.targets === visual && typeof config.x === 'number')
  assert.ok(pose)
  assert.ok(pose.x < enemy.x, 'charge recoil must be away from the explicit target, not localPlayer')
})
