import test from 'node:test'
import assert from 'node:assert/strict'

import {
  acceptAuthorityEnvelope,
  consumeRemainingDuration,
  createInitialAuthority,
  nextAuthority,
  nextAuthorityEnvelope,
} from './session-authority.js'

test('room host is only the initial epoch-one authority', () => {
  assert.deepEqual(createInitialAuthority('p1'), {
    epoch: 1,
    authorityId: 'p1',
    sequence: 0,
  })
})

test('authority takeover increments epoch and resets sequence', () => {
  const initial = createInitialAuthority('p1')
  assert.deepEqual(nextAuthority(initial, 'p2'), {
    epoch: 2,
    authorityId: 'p2',
    sequence: 0,
  })
})

test('same epoch accepts only the current authority with a newer sequence', () => {
  const current = { epoch: 3, authorityId: 'p2', sequence: 7 }

  assert.deepEqual(
    acceptAuthorityEnvelope(current, { epoch: 3, authorityId: 'p2', sequence: 8 }),
    { epoch: 3, authorityId: 'p2', sequence: 8 },
  )
  assert.equal(
    acceptAuthorityEnvelope(current, { epoch: 3, authorityId: 'p1', sequence: 8 }),
    null,
  )
  assert.equal(
    acceptAuthorityEnvelope(current, { epoch: 3, authorityId: 'p2', sequence: 7 }),
    null,
  )
})

test('higher epoch supersedes old authority even when old authority has a larger sequence', () => {
  const current = { epoch: 2, authorityId: 'p1', sequence: 999 }

  assert.deepEqual(
    acceptAuthorityEnvelope(current, { epoch: 3, authorityId: 'p2', sequence: 0 }),
    { epoch: 3, authorityId: 'p2', sequence: 0 },
  )
})

test('stale authority facts cannot overwrite a newer epoch', () => {
  const takenOver = { epoch: 4, authorityId: 'p2', sequence: 2 }
  assert.equal(
    acceptAuthorityEnvelope(takenOver, { epoch: 3, authorityId: 'p1', sequence: 5000 }),
    null,
  )
})

test('next envelope advances sequence without changing epoch or authority', () => {
  const authority = { epoch: 4, authorityId: 'p2', sequence: 9 }
  assert.deepEqual(nextAuthorityEnvelope(authority), {
    epoch: 4,
    authorityId: 'p2',
    sequence: 10,
  })
})

test('authority envelopes survive JSON round trip as plain durable data', () => {
  const envelope = nextAuthorityEnvelope(nextAuthority(createInitialAuthority('p1'), 'p2'))
  assert.deepEqual(JSON.parse(JSON.stringify(envelope)), envelope)
})

test('remaining revive duration is consumed instead of restarted on handoff', () => {
  assert.equal(consumeRemainingDuration(3000, 1200), 1800)
  assert.equal(consumeRemainingDuration(1800, 2500), 0)
  assert.equal(consumeRemainingDuration(1800, -50), 1800)
})

test('authority ids are required and epochs/sequences are normalized to safe integers', () => {
  assert.throws(() => createInitialAuthority('   '), /authority/i)
  assert.throws(() => nextAuthority({ epoch: 1, authorityId: 'p1', sequence: 0 }, ''), /authority/i)
  assert.equal(
    acceptAuthorityEnvelope(
      { epoch: 1, authorityId: 'p1', sequence: 0 },
      { epoch: Number.NaN, authorityId: 'p1', sequence: 1 },
    ),
    null,
  )
})
