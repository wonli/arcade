import test from 'node:test'
import assert from 'node:assert/strict'
import { createReplayController } from './controller.js'

function fakeClock() {
  let current = 0
  let sequence = 0
  const tasks = new Map()
  const now = () => current
  const setTimeoutFn = (fn, delay) => {
    const id = ++sequence
    tasks.set(id, { at: current + delay, fn })
    return id
  }
  const clearTimeoutFn = (id) => tasks.delete(id)
  async function flush() { for (let i = 0; i < 8; i += 1) await Promise.resolve() }
  async function advance(ms) {
    const target = current + ms
    while (true) {
      let nextID = null
      let next = null
      for (const [id, task] of tasks) {
        if (task.at <= target && (!next || task.at < next.at)) { nextID = id; next = task }
      }
      if (!next) break
      current = next.at
      tasks.delete(nextID)
      next.fn()
      await flush()
    }
    current = target
    await flush()
  }
  return { now, setTimeoutFn, clearTimeoutFn, advance }
}

function bytes(text) { return new TextEncoder().encode(text) }

function subject({ isHost = true, clock, encode, acquireLease, upload }) {
  const recorder = { snapshot: () => ({ durationMs: Math.max(1, clock.now()), frames: [1] }), reset() {} }
  return createReplayController({
    game: 'tetris', roomId: 'ABC123', players: () => 2, isHost: () => isHost,
    version: 1, recorder, encode,
    acquireLease, upload,
    hash: async (data) => `hash:${new TextDecoder().decode(data)}`,
    now: clock.now, setTimeoutFn: clock.setTimeoutFn, clearTimeoutFn: clock.clearTimeoutFn,
    firstUploadMs: 20_000, refreshMs: 180_000,
  })
}

test('non-host never leases or uploads', async () => {
  const clock = fakeClock()
  let leases = 0
  let uploads = 0
  const controller = subject({ isHost: false, clock, encode: () => bytes('one'), acquireLease: async () => { leases += 1 }, upload: async () => { uploads += 1 } })
  await controller.start()
  await clock.advance(300_000)
  assert.equal(leases, 0)
  assert.equal(uploads, 0)
})

test('host uploads first replay after twenty seconds then no sooner than three minutes', async () => {
  const clock = fakeClock()
  let uploads = 0
  const controller = subject({ clock, encode: () => bytes(`v${uploads + 1}`), acquireLease: async () => ({ token: 'lease' }), upload: async () => { uploads += 1 } })
  await controller.start()
  await clock.advance(19_999)
  assert.equal(uploads, 0)
  await clock.advance(1)
  assert.equal(uploads, 1)
  await clock.advance(179_999)
  assert.equal(uploads, 1)
  await clock.advance(1)
  assert.equal(uploads, 2)
})

test('finish forces upload and identical hash skips duplicate upload', async () => {
  const clock = fakeClock()
  let uploads = 0
  const controller = subject({ clock, encode: () => bytes('same'), acquireLease: async () => ({ token: 'lease' }), upload: async () => { uploads += 1 } })
  await controller.start()
  await clock.advance(20_000)
  assert.equal(uploads, 1)
  await controller.finish()
  assert.equal(uploads, 1)
})

test('oversized replay is rejected locally and gameplay-facing calls do not throw', async () => {
  const clock = fakeClock()
  let uploads = 0
  const controller = subject({ clock, encode: () => new Uint8Array((100 << 10) + 1), acquireLease: async () => ({ token: 'lease' }), upload: async () => { uploads += 1 } })
  await controller.start()
  await clock.advance(20_000)
  assert.equal(uploads, 0)
  assert.equal(controller.getState().phase, 'error')
})

test('busy lease leaves replay idle without failing gameplay', async () => {
  const clock = fakeClock()
  const error = new Error('replay lease busy')
  const controller = subject({ clock, encode: () => bytes('one'), acquireLease: async () => { throw error }, upload: async () => {} })
  await controller.start()
  assert.equal(controller.getState().phase, 'idle')
  await clock.advance(30_000)
  assert.equal(controller.getState().phase, 'idle')
})
