import test from 'node:test'
import assert from 'node:assert/strict'
import { createReplaySession, finalizeReplaySession } from './session.js'

test('finalize waits for the final replay upload before destroying the session', async () => {
  let resolveFinish
  let destroyed = false
  let received = null
  const finishPending = new Promise((resolve) => { resolveFinish = resolve })
  const session = {
    finish(value) {
      received = value
      return finishPending
    },
    destroy() {
      destroyed = true
    },
  }
  const snapshot = { players: [{ id: 'host' }, { id: 'guest' }] }

  const finalizing = finalizeReplaySession(session, snapshot)
  assert.equal(received, snapshot)
  assert.equal(destroyed, false)

  resolveFinish(true)
  assert.equal(await finalizing, true)
  assert.equal(destroyed, true)
})

test('finalize still destroys the replay session when the final upload fails', async () => {
  let destroyed = false
  const session = {
    async finish() {
      throw new Error('upload failed')
    },
    destroy() {
      destroyed = true
    },
  }

  await assert.rejects(() => finalizeReplaySession(session, { players: [{ id: 'host' }] }), /upload failed/)
  assert.equal(destroyed, true)
})

test('session buffers semantic events before lease start and preserves their timestamps and order', async () => {
  const writes = []
  let resolveLease
  const leasePending = new Promise((resolve) => { resolveLease = resolve })
  const recorder = {
    reset() {},
    record(value, at) { writes.push(['state', at, value]); return true },
    recordEvent(event, at) { writes.push(['event', at, event]); return true },
    snapshot() { return { version: 3, durationMs: 1, frames: [{ t: 0, state: {} }], events: [] } },
  }
  const adapter = {
    id: 'dungeon',
    version: 3,
    createRecorder: () => recorder,
    encode: () => new Uint8Array([1]),
  }
  const socket = {
    request(action) {
      if (action === 'replay.lease') return leasePending
      if (action === 'replay.release') return Promise.resolve({ released: true })
      throw new Error(`unexpected ${action}`)
    },
  }
  const room = () => ({ hostId: 'host', players: [{ id: 'host' }] })
  const session = createReplaySession({ adapter, roomCode: 'ROOM', room, identity: { sessionId: 'host' }, socket, now: () => 100 })

  session.record({ players: [{ id: 'host' }] }, { at: 10, force: true })
  assert.equal(session.recordEvent({ type: 'hit', targetId: 'e1' }, { at: 11 }), true)
  assert.equal(session.recordEvent({ type: 'death', entityId: 'e1' }, { at: 12 }), true)
  assert.deepEqual(writes, [])

  resolveLease({ token: 'lease' })
  for (let i = 0; i < 8; i += 1) await Promise.resolve()
  assert.deepEqual(writes, [
    ['state', 10, { players: [{ id: 'host' }] }],
    ['event', 11, { type: 'hit', targetId: 'e1' }],
    ['event', 12, { type: 'death', entityId: 'e1' }],
  ])
  session.destroy()
})
