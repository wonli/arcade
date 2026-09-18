import { createReplayController } from './controller.js'

export function createReplaySession({
  adapter,
  roomCode,
  room,
  identity,
  socket,
  now = () => Date.now(),
} = {}) {
  if (!adapter?.id || !adapter?.createRecorder || !adapter?.encode) throw new Error('replay adapter is required')

  const recorder = adapter.createRecorder({ now })
  const isHost = () => room()?.hostId === identity?.sessionId
  const controller = createReplayController({
    game: adapter.id,
    roomId: roomCode,
    players: () => room()?.players?.length ?? 0,
    isHost,
    version: adapter.version,
    socket,
    recorder,
    encode: adapter.encode,
    now,
  })

  let started = false
  let starting = null
  let pending = null

  function write(sample) {
    if (!sample) return false
    return controller.record(sample.value, sample.at, sample.options)
  }

  async function ensureStarted() {
    if (!isHost()) return false
    if (started) return true
    if (starting) return starting
    starting = controller.start().then((ok) => {
      started = !!ok
      if (started && pending) {
        const sample = pending
        pending = null
        write(sample)
      }
      return started
    }).finally(() => { starting = null })
    return starting
  }

  function record(value, { at = now(), force = false } = {}) {
    if (!isHost() || value == null) return false
    const sample = { value, at, options: { force } }
    if (started) return write(sample)
    pending = sample
    void ensureStarted()
    return true
  }

  async function finish(value = null) {
    if (!isHost()) return false
    if (value != null) pending = { value, at: now(), options: { force: true } }
    const active = await ensureStarted()
    if (!active) return false
    if (pending) {
      const sample = pending
      pending = null
      write(sample)
    }
    const uploaded = await controller.finish()
    started = false
    return uploaded
  }

  async function restart(value = null) {
    if (!isHost()) return false
    if (starting) await starting
    if (started) await controller.finish()
    started = false
    pending = value == null ? null : { value, at: now(), options: { force: true } }
    recorder.reset?.()
    return ensureStarted()
  }

  function destroy() {
    pending = null
    started = false
    controller.destroy()
  }

  return {
    record,
    finish,
    restart,
    destroy,
    isHost,
    getState: controller.getState,
    subscribe: controller.subscribe,
  }
}

export async function finalizeReplaySession(session, value = null) {
  if (!session) return false
  try {
    return await session.finish(value)
  } finally {
    session.destroy()
  }
}
