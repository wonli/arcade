import test from 'node:test'
import assert from 'node:assert/strict'
import { swipeDirection } from './swipe.js'

test('swipeDirection ignores short gestures', () => {
  assert.equal(swipeDirection({ x: 10, y: 10 }, { x: 24, y: 18 }), null)
})

test('swipeDirection uses the dominant horizontal axis', () => {
  assert.equal(swipeDirection({ x: 10, y: 10 }, { x: 80, y: 30 }), 'right')
  assert.equal(swipeDirection({ x: 80, y: 10 }, { x: 10, y: 25 }), 'left')
})

test('swipeDirection uses the dominant vertical axis', () => {
  assert.equal(swipeDirection({ x: 10, y: 10 }, { x: 25, y: 90 }), 'down')
  assert.equal(swipeDirection({ x: 10, y: 90 }, { x: 20, y: 10 }), 'up')
})
