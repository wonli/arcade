import test from 'node:test'
import assert from 'node:assert/strict'
import { joystickVector, clampJoystickVector } from './joystick.js'

test('joystickVector centers input, caps radius, and applies deadzone', () => {
  const rect = { left: 0, top: 0, width: 100, height: 100 }
  assert.deepEqual(joystickVector(50, 50, rect), { x: 0, y: 0 })
  assert.deepEqual(joystickVector(100, 50, rect), { x: 1, y: 0 })
  const diagonal = joystickVector(100, 100, rect)
  assert.ok(Math.abs(Math.hypot(diagonal.x, diagonal.y) - 1) < 1e-9)
})

test('clampJoystickVector normalizes arbitrary movement vectors for reuse by games', () => {
  assert.deepEqual(clampJoystickVector(0, 0), { x: 0, y: 0 })
  const vector = clampJoystickVector(3, 4)
  assert.equal(vector.x, 0.6)
  assert.equal(vector.y, 0.8)
})
