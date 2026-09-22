import test from 'node:test'
import assert from 'node:assert/strict'

import { NODES, EDGES, connected, legalDestinations } from './graph.js'

test('police thief board preserves the six-node paper graph', () => {
  assert.deepEqual(NODES.map(({ id }) => id), ['A', 'B', 'C', 'D', 'E', 'F'])
  assert.deepEqual(EDGES, [
    ['A', 'B'], ['A', 'C'], ['A', 'D'], ['B', 'E'],
    ['C', 'E'], ['C', 'F'], ['D', 'F'], ['E', 'F'],
  ])
})

test('movement uses drawn edges rather than visual proximity', () => {
  assert.equal(connected('B', 'C'), false)
  assert.equal(connected('B', 'E'), true)
  assert.deepEqual(legalDestinations('B'), ['A', 'E'])
  assert.equal(connected('B', 'B'), false)
})
