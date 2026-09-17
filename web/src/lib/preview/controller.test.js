import test from 'node:test'
import assert from 'node:assert/strict'
import { createPreviewController } from './controller.js'

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
  async function flush() {
    for (let index = 0; index < 6; index++) await Promise.resolve()
  }
  async function advance(ms) {
    const target = current + ms
    while (true) {
      let nextID = null
      let nextTask = null
      for (const [id, task] of tasks) {
        if (task.at <= target && (!nextTask || task.at < nextTask.at)) { nextID = id; nextTask = task }
      }
      if (!nextTask) break
      current = nextTask.at
      tasks.delete(nextID)
      nextTask.fn()
      await flush()
    }
    current = target
    await flush()
  }
  return { now, setTimeoutFn, clearTimeoutFn, advance }
}

function subject({ clock, upload }) {
  let captures = 0
  const controller = createPreviewController({
    game: 'tetris',
    roomId: 'ABC123',
    players: () => 2,
    capture: async () => { captures += 1; return { blob: new Blob(['image'], { type: 'image/jpeg' }), summary: { score: 10 } } },
    upload,
    now: clock.now,
    setTimeoutFn: clock.setTimeoutFn,
    clearTimeoutFn: clock.clearTimeoutFn,
    autoDelayMs: 10_000,
    cooldownMs: 30_000,
  })
  return { controller, captures: () => captures }
}

test('automatic capture fires once ten seconds after entering playing', async () => {
  const clock = fakeClock()
  let uploads = 0
  const { controller, captures } = subject({ clock, upload: async () => { uploads += 1; return {} } })

  controller.enterPlaying('match-1')
  await clock.advance(9_999)
  assert.equal(captures(), 0)
  await clock.advance(1)
  assert.equal(captures(), 1)
  assert.equal(uploads, 1)

  controller.enterPlaying('match-1')
  await clock.advance(15_000)
  assert.equal(captures(), 1)
  controller.destroy()
})

test('waiting/leave cancels pending automatic capture', async () => {
  const clock = fakeClock()
  const { controller, captures } = subject({ clock, upload: async () => ({}) })
  controller.enterPlaying('match-1')
  await clock.advance(4_000)
  controller.leavePlaying()
  await clock.advance(20_000)
  assert.equal(captures(), 0)
  assert.equal(controller.getState().phase, 'idle')
})

test('successful update enforces local cooldown before manual refresh', async () => {
  const clock = fakeClock()
  let uploads = 0
  const { controller } = subject({ clock, upload: async () => { uploads += 1; return {} } })
  controller.enterPlaying('match-1')
  await clock.advance(10_000)
  assert.equal(uploads, 1)
  assert.equal(controller.getState().cooldownRemaining, 30)

  assert.equal(await controller.updateNow(), false)
  await clock.advance(30_000)
  assert.equal(controller.getState().cooldownRemaining, 0)
  assert.equal(await controller.updateNow(), true)
  assert.equal(uploads, 2)
})

test('capture/upload failure does not start cooldown and can retry immediately', async () => {
  const clock = fakeClock()
  let fail = true
  let uploads = 0
  const { controller } = subject({ clock, upload: async () => { uploads += 1; if (fail) throw new Error('offline'); return {} } })
  controller.enterPlaying('match-1')
  await clock.advance(10_000)
  assert.equal(controller.getState().phase, 'error')
  assert.equal(controller.getState().cooldownRemaining, 0)

  fail = false
  assert.equal(await controller.updateNow(), true)
  assert.equal(uploads, 2)
  assert.equal(controller.getState().cooldownRemaining, 30)
})

test('server retryAfter replaces the local cooldown', async () => {
  const clock = fakeClock()
  const error = new Error('cooldown')
  error.retryAfter = 17
  const { controller } = subject({ clock, upload: async () => { throw error } })
  controller.enterPlaying('match-1')
  await clock.advance(10_000)
  assert.equal(controller.getState().phase, 'cooldown')
  assert.equal(controller.getState().cooldownRemaining, 17)
})
