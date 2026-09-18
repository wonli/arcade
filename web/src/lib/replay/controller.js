import {
  acquireReplayLease as acquireLeaseRequest,
  releaseReplayLease as releaseLeaseRequest,
  uploadReplay,
} from './client.js'
import { setReplayStatus } from './status.js'

export const MAX_REPLAY_BYTES = 100 << 10

export function createReplayController({
  game,
  roomId,
  players = () => 0,
  isHost = () => false,
  version = 1,
  socket,
  recorder,
  encode,
  acquireLease = (request) => acquireLeaseRequest({ socket, ...request }),
  releaseLease = (request) => releaseLeaseRequest({ socket, ...request }),
  upload = (payload) => uploadReplay(payload),
  hash = sha256Hex,
  now = () => Date.now(),
  setTimeoutFn = setTimeout,
  clearTimeoutFn = clearTimeout,
  firstUploadMs = 20_000,
  refreshMs = 180_000,
  errorDisplayMs = 3_000,
} = {}) {
  let active = false
  let destroyed = false
  let lease = null
  let timer = null
  let errorTimer = null
  let lastHash = ''
  let startedAt = 0
  let state = { phase: 'idle', game, error: '' }
  const listeners = new Set()

  function emit(next) {
    state = { ...state, ...next, game }
    for (const listener of listeners) listener(state)
    setReplayStatus(state)
  }

  function clearTimer() {
    if (timer != null) clearTimeoutFn(timer)
    timer = null
  }

  function clearErrorTimer() {
    if (errorTimer != null) clearTimeoutFn(errorTimer)
    errorTimer = null
  }

  function schedule(delay) {
    clearTimer()
    if (!active || destroyed) return
    timer = setTimeoutFn(() => {
      timer = null
      void uploadCurrent().finally(() => {
        if (active && !destroyed) schedule(refreshMs)
      })
    }, delay)
  }

  async function ensureLease() {
    if (!active || destroyed) return null
    try {
      lease = await acquireLease({ roomId: valueOf(roomId), game })
      return lease
    } catch (error) {
      if (/lease busy/i.test(error?.message ?? '')) {
        active = false
        lease = null
        clearTimer()
        emit({ phase: 'idle', error: '' })
        return null
      }
      replayError(error)
      return null
    }
  }

  async function releaseCurrentLease() {
    const current = lease
    lease = null
    if (!current?.token) return false
    try {
      return await releaseLease({ game, lease: current.token })
    } catch {
      return false
    }
  }

  function replayError(error) {
    const message = error?.message || 'replay error'
    emit({ phase: 'error', error: message })
    clearErrorTimer()
    if (!destroyed) {
      errorTimer = setTimeoutFn(() => {
        errorTimer = null
        if (!destroyed) emit({ phase: active ? 'recording' : 'idle', error: '' })
      }, errorDisplayMs)
    }
  }

  async function uploadCurrent({ final = false } = {}) {
    if (!active || destroyed || !isHost()) return false
    try {
      const recording = recorder?.snapshot?.()
      if (!recording) return false
      const bytes = normalizeBytes(await encode(recording))
      if (!bytes.length) return false
      if (bytes.byteLength > MAX_REPLAY_BYTES) {
        replayError(new Error(`replay exceeds ${MAX_REPLAY_BYTES} bytes`))
        return false
      }
      const currentHash = await hash(bytes)
      if (currentHash === lastHash) return false

      const currentLease = await ensureLease()
      if (!currentLease?.token) return false

      emit({ phase: 'uploading', error: '' })
      const elapsed = Math.max(1, now() - startedAt)
      const durationMS = clamp(Number(recording.durationMs) || elapsed, 1, 30_000)
      await upload({
        game,
        lease: currentLease.token,
        version,
        durationMs: durationMS,
        players: clamp(Number(valueOf(players)) || 0, 0, 8),
        hash: currentHash,
        bytes,
      })
      lastHash = currentHash
      emit({ phase: final ? 'saved' : 'recording', error: '' })
      return true
    } catch (error) {
      replayError(error)
      return false
    }
  }

  async function start() {
    if (destroyed || active || !isHost()) return false
    active = true
    startedAt = now()
    lastHash = ''
    recorder?.reset?.()
    const currentLease = await ensureLease()
    if (!currentLease?.token) {
      active = false
      lease = null
      return false
    }
    emit({ phase: 'recording', error: '' })
    schedule(firstUploadMs)
    return true
  }

  async function finish() {
    if (!active || destroyed) return false
    clearTimer()
    const uploaded = await uploadCurrent({ final: true })
    active = false
    await releaseCurrentLease()
    clearErrorTimer()
    if (!uploaded) emit({ phase: 'idle', error: '' })
    else {
      errorTimer = setTimeoutFn(() => {
        errorTimer = null
        if (!active && !destroyed) emit({ phase: 'idle', error: '' })
      }, 2_000)
    }
    return uploaded
  }

  function destroy() {
    destroyed = true
    active = false
    clearTimer()
    clearErrorTimer()
    void releaseCurrentLease()
    emit({ phase: 'idle', error: '' })
    listeners.clear()
  }

  return {
    start,
    finish,
    destroy,
    uploadNow: () => uploadCurrent(),
    record: (...args) => recorder?.record?.(...args),
    subscribe(listener) { listeners.add(listener); listener(state); return () => listeners.delete(listener) },
    getState: () => state,
  }
}

function valueOf(value) { return typeof value === 'function' ? value() : value }
function clamp(value, min, max) { return Math.min(max, Math.max(min, value)) }

function normalizeBytes(value) {
  if (value instanceof Uint8Array) return value
  if (value instanceof ArrayBuffer) return new Uint8Array(value)
  if (ArrayBuffer.isView(value)) return new Uint8Array(value.buffer, value.byteOffset, value.byteLength)
  if (typeof value === 'string') return new TextEncoder().encode(value)
  throw new Error('replay encoder must return bytes')
}

async function sha256Hex(bytes) {
  if (!globalThis.crypto?.subtle) throw new Error('Web Crypto is unavailable')
  const digest = await globalThis.crypto.subtle.digest('SHA-256', bytes)
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('')
}
