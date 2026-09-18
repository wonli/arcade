import test from 'node:test'
import assert from 'node:assert/strict'

import { matchesPendingResponse, nextRequestId } from './request-correlation.js'

test('request ids are unique and pending responses require the matching action and id', () => {
  const first = nextRequestId('test', () => null, () => 100)
  const second = nextRequestId('test', () => null, () => 100)

  assert.notEqual(first, second)
  assert.equal(matchesPendingResponse({ id: first, action: 'dungeon.snapshot' }, { id: first, action: 'dungeon.snapshot' }), true)
  assert.equal(matchesPendingResponse({ id: '', action: 'dungeon.snapshot' }, { id: first, action: 'dungeon.snapshot' }), false)
  assert.equal(matchesPendingResponse({ id: second, action: 'dungeon.snapshot' }, { id: first, action: 'dungeon.snapshot' }), false)
  assert.equal(matchesPendingResponse({ id: first, action: 'dungeon.command' }, { id: first, action: 'dungeon.snapshot' }), false)
})
