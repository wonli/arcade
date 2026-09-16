import test from 'node:test'
import assert from 'node:assert/strict'

import { createSessionSyncRuntime } from './session-sync-runtime.js'

test('follower moves BOOTSTRAP -> HYDRATING -> LIVE and gates ordinary snapshots until hydrated', () => {
  const sync = createSessionSyncRuntime({ authority: false })

  assert.equal(sync.phase(), 'BOOTSTRAP')
  assert.equal(sync.mayPublishSnapshot(), false)

  sync.startFollowerHydration()
  assert.equal(sync.phase(), 'HYDRATING')
  assert.equal(sync.mayPublishSnapshot(), false)

  sync.acceptCheckpoint()
  assert.equal(sync.phase(), 'LIVE')
  assert.equal(sync.mayPublishSnapshot(), true)
})

test('follower reconnect returns to HYDRATING before live snapshots resume', () => {
  const sync = createSessionSyncRuntime({ authority: false })
  sync.startFollowerHydration()
  sync.acceptCheckpoint()

  sync.beginReconnect()
  assert.equal(sync.phase(), 'RECONNECTING')
  assert.equal(sync.mayPublishSnapshot(), false)

  sync.startFollowerHydration()
  assert.equal(sync.phase(), 'HYDRATING')
  assert.equal(sync.mayPublishSnapshot(), false)

  sync.acceptCheckpoint()
  assert.equal(sync.phase(), 'LIVE')
  assert.equal(sync.mayPublishSnapshot(), true)
})

test('authority becomes LIVE only when canonical authority state is established', () => {
  const sync = createSessionSyncRuntime({ authority: true })

  assert.equal(sync.phase(), 'BOOTSTRAP')
  assert.equal(sync.mayPublishSnapshot(), false)

  sync.takeAuthority()
  assert.equal(sync.phase(), 'LIVE')
  assert.equal(sync.mayPublishSnapshot(), true)
})
