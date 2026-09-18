import test from 'node:test'
import assert from 'node:assert/strict'
import { finalizeReplaySession } from './session.js'

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
