import test from 'node:test'
import assert from 'node:assert/strict'
import { createRetreatRequest } from './retreat-flow.js'

test('retreat request stays pending until the UI resolves it', () => {
  let requested
  let retreats = 0
  let cancels = 0
  const request = createRetreatRequest({
    onRequest(actions) { requested = actions },
    onConfirm() { retreats++ },
    onCancel() { cancels++ },
  })

  request()
  assert.equal(retreats, 0)
  assert.equal(cancels, 0)
  requested.confirm()
  assert.equal(retreats, 1)
})

test('retreat request can be cancelled exactly once', () => {
  let requested
  let retreats = 0
  let cancels = 0
  const request = createRetreatRequest({
    onRequest(actions) { requested = actions },
    onConfirm() { retreats++ },
    onCancel() { cancels++ },
  })

  request()
  requested.cancel()
  requested.confirm()
  assert.equal(retreats, 0)
  assert.equal(cancels, 1)
})
