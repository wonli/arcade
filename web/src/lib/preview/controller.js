export function createPreviewController({
  game,
  capture,
  upload,
  roomId = '',
  players = 0,
  now = Date.now,
  setTimeoutFn = globalThis.setTimeout,
  clearTimeoutFn = globalThis.clearTimeout,
  autoDelayMs = 10_000,
  cooldownMs = 30_000,
}) {
  let timer = null
  let playing = false
  let currentSession = null
  let autoDeadline = 0
  let cooldownUntil = 0
  let destroyed = false
  const listeners = new Set()
  let state = {
    phase: 'idle',
    autoRemaining: 0,
    cooldownRemaining: 0,
    error: '',
  }

  const snapshot = () => ({ ...state })
  const emit = (patch = {}) => {
    state = { ...state, ...patch }
    for (const listener of listeners) listener(snapshot())
  }
  const cancelTimer = () => {
    if (timer != null) clearTimeoutFn(timer)
    timer = null
  }
  const schedule = (fn, delay) => {
    cancelTimer()
    timer = setTimeoutFn(() => {
      timer = null
      fn()
    }, Math.max(0, delay))
  }

  function countdownTick() {
    if (!playing || destroyed) return
    const remainingMs = autoDeadline - now()
    if (remainingMs <= 0) {
      void runUpdate(true)
      return
    }
    emit({ phase: 'countdown', autoRemaining: Math.ceil(remainingMs / 1000), cooldownRemaining: 0, error: '' })
    schedule(countdownTick, Math.min(1000, remainingMs))
  }

  function cooldownTick() {
    if (!playing || destroyed) return
    const remainingMs = cooldownUntil - now()
    if (remainingMs <= 0) {
      cooldownUntil = 0
      emit({ phase: 'ready', cooldownRemaining: 0, autoRemaining: 0, error: '' })
      return
    }
    const nextPhase = state.phase === 'updated' ? 'updated' : 'cooldown'
    emit({ phase: nextPhase, cooldownRemaining: Math.ceil(remainingMs / 1000), autoRemaining: 0, error: '' })
    if (nextPhase === 'updated') state = { ...state, phase: 'cooldown' }
    schedule(cooldownTick, Math.min(1000, remainingMs))
  }

  function beginCooldown(durationMs, showUpdated = false) {
    cooldownUntil = now() + Math.max(1000, durationMs)
    emit({
      phase: showUpdated ? 'updated' : 'cooldown',
      cooldownRemaining: Math.ceil((cooldownUntil - now()) / 1000),
      autoRemaining: 0,
      error: '',
    })
    schedule(cooldownTick, Math.min(1000, cooldownUntil - now()))
  }

  async function runUpdate(automatic = false) {
    if (!playing || destroyed) return false
    if (!automatic && state.phase === 'countdown') return false
    if (state.phase === 'uploading') return false
    const remainingMs = cooldownUntil - now()
    if (remainingMs > 0) {
      emit({ phase: 'cooldown', cooldownRemaining: Math.ceil(remainingMs / 1000), error: '' })
      return false
    }

    cancelTimer()
    emit({ phase: 'uploading', autoRemaining: 0, cooldownRemaining: 0, error: '' })
    try {
      const captured = await capture()
      if (!captured?.blob) throw new Error('preview capture returned no image')
      await upload({
        game,
        blob: captured.blob,
        summary: captured.summary ?? {},
        roomId: typeof roomId === 'function' ? roomId() : roomId,
        players: typeof players === 'function' ? players() : players,
      })
      beginCooldown(cooldownMs, true)
      return true
    } catch (error) {
      const retryAfter = Number(error?.retryAfter)
      if (Number.isFinite(retryAfter) && retryAfter > 0) {
        beginCooldown(retryAfter * 1000, false)
      } else {
        cooldownUntil = 0
        emit({ phase: 'error', cooldownRemaining: 0, error: error?.message || 'preview update failed' })
      }
      return false
    }
  }

  function enterPlaying(sessionKey) {
    if (destroyed) return
    const key = String(sessionKey ?? 'default')
    if (playing && currentSession === key) return
    cancelTimer()
    playing = true
    currentSession = key
    cooldownUntil = 0
    autoDeadline = now() + autoDelayMs
    emit({ phase: 'countdown', autoRemaining: Math.ceil(autoDelayMs / 1000), cooldownRemaining: 0, error: '' })
    schedule(countdownTick, Math.min(1000, autoDelayMs))
  }

  function leavePlaying() {
    cancelTimer()
    playing = false
    currentSession = null
    autoDeadline = 0
    cooldownUntil = 0
    emit({ phase: 'idle', autoRemaining: 0, cooldownRemaining: 0, error: '' })
  }

  function subscribe(listener) {
    if (typeof listener !== 'function') return () => {}
    listeners.add(listener)
    listener(snapshot())
    return () => listeners.delete(listener)
  }

  function destroy() {
    if (destroyed) return
    destroyed = true
    cancelTimer()
    listeners.clear()
  }

  return {
    enterPlaying,
    leavePlaying,
    updateNow: () => runUpdate(false),
    subscribe,
    getState: snapshot,
    destroy,
  }
}
