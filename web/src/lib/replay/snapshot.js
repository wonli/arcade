import { createRollingTimeline } from './timeline.js'
import { MAX_REPLAY_BYTES } from './controller.js'

const encoder = new TextEncoder()
const decoder = new TextDecoder()

export function createSnapshotRecorder({
  windowMs = 20_000,
  minIntervalMs = 0,
  sanitize = (value) => value,
  now = () => Date.now(),
} = {}) {
  const timeline = createRollingTimeline({ windowMs, now })
  let lastAt = -Infinity
  let lastSignature = ''

  return {
    record(value, at = now(), { force = false } = {}) {
      if (!force && at - lastAt < minIntervalMs) return false
      const clean = sanitize(value)
      if (clean == null) return false
      const signature = JSON.stringify(clean)
      if (!force && signature === lastSignature) return false
      lastAt = at
      lastSignature = signature
      timeline.push(clean, at)
      return true
    },
    snapshot() {
      const value = timeline.snapshot()
      return {
        durationMs: value.durationMs,
        frames: value.entries.map((entry) => ({ t: entry.t, state: entry.value })),
      }
    },
    reset() {
      lastAt = -Infinity
      lastSignature = ''
      timeline.reset()
    },
  }
}

export function encodeCompactRecording(recording, { maxBytes = MAX_REPLAY_BYTES } = {}) {
  let candidate = normalizeRecording(recording)
  let bytes = encoder.encode(JSON.stringify(candidate))
  while (bytes.byteLength > maxBytes && candidate.frames.length > 2) {
    const frames = [candidate.frames[0]]
    for (let index = 1; index < candidate.frames.length - 1; index += 2) frames.push(candidate.frames[index])
    frames.push(candidate.frames[candidate.frames.length - 1])
    candidate = { ...candidate, frames }
    bytes = encoder.encode(JSON.stringify(candidate))
  }
  while (bytes.byteLength > maxBytes && candidate.frames.length > 1) {
    candidate = { ...candidate, frames: candidate.frames.slice(1) }
    candidate = rebaseRecording(candidate)
    bytes = encoder.encode(JSON.stringify(candidate))
  }
  if (bytes.byteLength > maxBytes) throw new Error(`replay exceeds ${maxBytes} bytes after compaction`)
  return bytes
}

export function decodeRecording(bytes) {
  const text = decoder.decode(bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes))
  const parsed = JSON.parse(text)
  if (!parsed || !Array.isArray(parsed.frames) || parsed.frames.length === 0) throw new Error('replay has no frames')
  return normalizeRecording(parsed)
}

export function createCanvasReplayPlayer(target, recording, draw, {
  width = 1280,
  height = 720,
  loopDelayMs = 700,
  setTimeoutFn = setTimeout,
  clearTimeoutFn = clearTimeout,
} = {}) {
  if (!target) throw new Error('replay target is required')
  const frames = normalizeRecording(recording).frames
  if (!frames.length) throw new Error('replay has no frames')

  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  canvas.setAttribute('aria-hidden', 'true')
  Object.assign(canvas.style, {
    width: `${width}px`,
    height: `${height}px`,
    flex: '0 0 auto',
    display: 'block',
  })
  target.replaceChildren(canvas)

  let timer = null
  let destroyed = false
  let index = 0

  function renderCurrent() {
    if (destroyed) return
    draw(canvas, frames[index].state)
    const current = frames[index]
    const nextIndex = index + 1
    if (nextIndex < frames.length) {
      const delay = clamp(frames[nextIndex].t - current.t, 40, 2_000)
      timer = setTimeoutFn(() => { index = nextIndex; renderCurrent() }, delay)
    } else {
      timer = setTimeoutFn(() => { index = 0; renderCurrent() }, loopDelayMs)
    }
  }

  renderCurrent()
  return {
    destroy() {
      destroyed = true
      if (timer != null) clearTimeoutFn(timer)
      if (canvas.parentNode === target) canvas.remove()
    },
  }
}

function normalizeRecording(recording = {}) {
  const frames = Array.isArray(recording.frames)
    ? recording.frames
        .filter((frame) => frame && Number.isFinite(Number(frame.t)) && frame.state != null)
        .map((frame) => ({ t: Math.max(0, Math.round(Number(frame.t))), state: frame.state }))
        .sort((a, b) => a.t - b.t)
    : []
  const durationMs = clamp(Math.round(Number(recording.durationMs) || frames.at(-1)?.t || 1), 1, 30_000)
  return rebaseRecording({ durationMs, frames })
}

function rebaseRecording(recording) {
  if (!recording.frames.length) return { durationMs: 1, frames: [] }
  const offset = recording.frames[0].t
  const frames = recording.frames.map((frame) => ({ ...frame, t: Math.max(0, frame.t - offset) }))
  return { durationMs: Math.max(1, frames.at(-1)?.t ?? 1), frames }
}

function clamp(value, min, max) { return Math.min(max, Math.max(min, value)) }
