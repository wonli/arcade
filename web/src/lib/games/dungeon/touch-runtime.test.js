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

test('touch movement exposes normalized intent without mutating keyboard state', () => {
  const scene = {
    keys: { A: { isDown: false }, D: { isDown: false }, W: { isDown: false }, S: { isDown: false }, SPACE: { isDown: false, _justDown: false } },
    input: { keyboard: { addKey() { return null } } },
    events: { once() {} },
  }
  const touch = installDungeonTouchInput(scene)
  touch.setMove(0.8, -0.6)
  const input = touch.getState()
  assert.equal(input.moveX, 0.8)
  assert.equal(input.moveY, -0.6)
  assert.equal(scene.keys.D.isDown, false)
  assert.equal(scene.keys.W.isDown, false)
})

test('install clears stale keyboard state left behind by a destroyed run', () => {
  let resetCalls = 0
  const scene = {
    keys: { A: { isDown: true }, D: { isDown: false }, W: { isDown: true }, S: { isDown: false }, SPACE: { isDown: true, _justDown: true } },
    input: { keyboard: { resetKeys() { resetCalls++ }, addKey() { return null } } },
    events: { once() {} },
  }
  installDungeonTouchInput(scene)
  assert.equal(resetCalls, 1)
  assert.equal(scene.keys.A.isDown, false)
  assert.equal(scene.keys.W.isDown, false)
  assert.equal(scene.keys.SPACE.isDown, false)
  assert.equal(scene.keys.SPACE._justDown, false)
})

test('skill and interact are one-shot normalized intents while interact still reaches solo E listeners', () => {
  let interacts = 0
  const eKey = { emit(event) { if (event === 'down') interacts++ } }
  const scene = {
    keys: { A: { isDown: false }, D: { isDown: false }, W: { isDown: false }, S: { isDown: false }, SPACE: { isDown: false, _justDown: false } },
    input: { keyboard: { addKey(name) { return name === 'E' ? eKey : null } } },
    events: { once() {} },
  }
  const touch = installDungeonTouchInput(scene)
  touch.triggerSkill()
  touch.triggerInteract()
  assert.equal(interacts, 1)
  assert.deepEqual(touch.consumeInput(), { seq: 0, moveX: 0, moveY: 0, skill: true, interact: true })
  assert.deepEqual(touch.getState(), { seq: 0, moveX: 0, moveY: 0, skill: false, interact: false })
})

test('touch audio cannot restart after the scene is dead', () => {
  let starts = 0
  const scene = {
    dead: true,
    ambient: { start() { starts++; return Promise.resolve() } },
    keys: { A: { isDown: false }, D: { isDown: false }, W: { isDown: false }, S: { isDown: false }, SPACE: { isDown: false, _justDown: false } },
    input: { keyboard: { addKey() { return null } } },
    events: { once() {} },
  }
  const touch = installDungeonTouchInput(scene)
  touch.setMove(1, 0)
  assert.equal(starts, 0)
})

test('shutdown clears touch runtime without replacing scene gameplay methods', () => {
  let shutdown = null
  const originalUpdate = function () {}
  const originalSkill = function () {}
  const scene = {
    keys: { A: { isDown: false }, D: { isDown: false }, W: { isDown: false }, S: { isDown: false }, SPACE: { isDown: false, _justDown: false } },
    updatePlayer: originalUpdate,
    trySkill: originalSkill,
    input: { keyboard: { addKey() { return null } } },
    events: { once(event, fn) { if (event === 'shutdown') shutdown = fn } },
  }
  installDungeonTouchInput(scene)
  assert.equal(scene.updatePlayer, originalUpdate)
  assert.equal(scene.trySkill, originalSkill)
  shutdown()
  assert.equal(scene.updatePlayer, originalUpdate)
  assert.equal(scene.trySkill, originalSkill)
  assert.equal(scene.__dungeonTouchInput, null)
})
