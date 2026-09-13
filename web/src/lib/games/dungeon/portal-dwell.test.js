import test from 'node:test'
import assert from 'node:assert/strict'

import { PORTAL_DWELL_MS, portalDwellState } from './portal-dwell.js'

test('portal dwell requires three continuous seconds before completing', () => {
  let state = portalDwellState({}, { inside: true, now: 1000 })
  assert.equal(PORTAL_DWELL_MS, 3000)
  assert.deepEqual(state, { enteredAt: 1000, seconds: 3, complete: false })

  state = portalDwellState(state, { inside: true, now: 2050 })
  assert.equal(state.seconds, 2)
  assert.equal(state.complete, false)

  state = portalDwellState(state, { inside: true, now: 3050 })
  assert.equal(state.seconds, 1)
  assert.equal(state.complete, false)

  state = portalDwellState(state, { inside: true, now: 4000 })
  assert.equal(state.seconds, 0)
  assert.equal(state.complete, true)
})

test('leaving the portal resets countdown so running through does not transition', () => {
  let state = portalDwellState({}, { inside: true, now: 1000 })
  state = portalDwellState(state, { inside: true, now: 2500 })
  assert.equal(state.seconds, 2)

  state = portalDwellState(state, { inside: false, now: 2600 })
  assert.deepEqual(state, { enteredAt: null, seconds: null, complete: false })

  state = portalDwellState(state, { inside: true, now: 5000 })
  assert.equal(state.enteredAt, 5000)
  assert.equal(state.seconds, 3)
  assert.equal(state.complete, false)
})
