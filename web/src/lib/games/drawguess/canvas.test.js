import test from 'node:test'
import assert from 'node:assert/strict'
import { mountCanvas } from './canvas.js'

test('initializes a canvas that appears after the lobby has mounted', () => {
  const context = { clearRect() {} }
  const observed = []
  let disconnected = false
  class FakeResizeObserver {
    constructor(callback) { this.callback = callback }
    observe(node) { observed.push(node) }
    disconnect() { disconnected = true }
  }
  const node = {
    width: 0,
    height: 0,
    getContext(type) {
      assert.equal(type, '2d')
      return context
    },
    getBoundingClientRect() { return { width: 800, height: 500 } },
  }

  let ready = null
  const mounted = mountCanvas(node, {
    ResizeObserverClass: FakeResizeObserver,
    devicePixelRatio: 2,
    onReady(canvas, ctx) { ready = { canvas, ctx } },
  })

  assert.equal(node.width, 1600)
  assert.equal(node.height, 1000)
  assert.deepEqual(observed, [node])
  assert.equal(ready.canvas, node)
  assert.equal(ready.ctx, context)

  mounted.destroy()
  assert.equal(disconnected, true)
})
