import { attachLegacyTestPlayer } from './test/player-fixture.js'
import test from 'node:test'
import assert from 'node:assert/strict'
import { joystickVector, installDungeonTouchInput } from './touch-runtime.js'

test('joystickVector keeps direction, caps radius, and applies deadzone', () => {
  const rect = { left: 0, top: 0, width: 100, height: 100 }
  assert.deepEqual(joystickVector(50, 50, rect), { x: 0, y: 0 })
  const right = joystickVector(100, 50, rect)
  assert.equal(right.x, 1)
  assert.equal(right.y, 0)
  const diagonal = joystickVector(100, 100, rect)
  assert.ok(Math.abs(Math.hypot(diagonal.x, diagonal.y) - 1) < 1e-9)
})

test('touch movement merges with keyboard for one update then restores key state', () => {
  let observed = null
  const scene = {
    keys: { A: { isDown: false }, D: { isDown: false }, W: { isDown: false }, S: { isDown: false }, SPACE: { _justDown: false } },
    updatePlayer() { observed = { A: this.keys.A.isDown, D: this.keys.D.isDown, W: this.keys.W.isDown, S: this.keys.S.isDown } },
    trySkill() {},
    input: { keyboard: { addKey() { return null } } },
    events: { once() {} },
  }
  const touch = installDungeonTouchInput(attachLegacyTestPlayer(scene))
  touch.setMove(0.8, -0.6)
  scene.updatePlayer(0.016)
  assert.deepEqual(observed, { A: false, D: true, W: true, S: false })
  assert.equal(scene.keys.D.isDown, false)
  assert.equal(scene.keys.W.isDown, false)
})

test('install clears stale keyboard state left behind by a destroyed run', () => {
  let resetCalls = 0
  const scene = {
    keys: { A: { isDown: true }, D: { isDown: false }, W: { isDown: true }, S: { isDown: false }, SPACE: { _justDown: true } },
    updatePlayer() {},
    trySkill() {},
    input: { keyboard: { resetKeys() { resetCalls++ }, addKey() { return null } } },
    events: { once() {} },
  }
  installDungeonTouchInput(attachLegacyTestPlayer(scene))
  assert.equal(resetCalls, 1)
  assert.equal(scene.keys.A.isDown, false)
  assert.equal(scene.keys.W.isDown, false)
  assert.equal(scene.keys.SPACE._justDown, false)
})

test('skill and interact reuse existing scene input paths', () => {
  let skillObserved = false
  let interacts = 0
  const eKey = { emit(event) { if (event === 'down') interacts++ } }
  const scene = {
    keys: { A: { isDown: false }, D: { isDown: false }, W: { isDown: false }, S: { isDown: false }, SPACE: { _justDown: false } },
    updatePlayer() {},
    trySkill() { skillObserved = this.keys.SPACE._justDown; this.keys.SPACE._justDown = false },
    input: { keyboard: { addKey(name) { return name === 'E' ? eKey : null } } },
    events: { once() {} },
  }
  const touch = installDungeonTouchInput(attachLegacyTestPlayer(scene))
  touch.triggerSkill()
  scene.trySkill(100)
  touch.triggerInteract()
  assert.equal(skillObserved, true)
  assert.equal(interacts, 1)
})

test('touch audio cannot restart after the scene is dead', () => {
  let starts = 0
  const scene = {
    dead: true,
    ambient: { start() { starts++; return Promise.resolve() } },
    keys: { A: { isDown: false }, D: { isDown: false }, W: { isDown: false }, S: { isDown: false }, SPACE: { _justDown: false } },
    updatePlayer() {},
    trySkill() {},
    input: { keyboard: { addKey() { return null } } },
    events: { once() {} },
  }
  const touch = installDungeonTouchInput(attachLegacyTestPlayer(scene))
  touch.setMove(1, 0)
  assert.equal(starts, 0)
})

test('shutdown restores wrapped scene methods', () => {
  let shutdown = null
  const originalUpdate = function () {}
  const originalSkill = function () {}
  const scene = {
    keys: { A: { isDown: false }, D: { isDown: false }, W: { isDown: false }, S: { isDown: false }, SPACE: { _justDown: false } },
    updatePlayer: originalUpdate,
    trySkill: originalSkill,
    input: { keyboard: { addKey() { return null } } },
    events: { once(event, fn) { if (event === 'shutdown') shutdown = fn } },
  }
  installDungeonTouchInput(attachLegacyTestPlayer(scene))
  assert.notEqual(scene.updatePlayer, originalUpdate)
  assert.notEqual(scene.trySkill, originalSkill)
  shutdown()
  assert.equal(scene.updatePlayer, originalUpdate)
  assert.equal(scene.trySkill, originalSkill)
  assert.equal(scene.__dungeonTouchInput, null)
})