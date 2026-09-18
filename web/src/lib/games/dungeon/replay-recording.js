const encoder = new TextEncoder()
const decoder = new TextDecoder()
const DEFAULT_MAX_BYTES = 100 << 10

export function createDungeonReplayRecorder({
  windowMs = 20_000,
  minIntervalMs = 160,
  sanitizeState = (value) => value,
  sanitizeEvent = (value) => value,
  now = () => Date.now(),
} = {}) {
  const frames = []
  const events = []
  let lastAt = -Infinity
  let lastSignature = ''
  let nextSeq = 0

  function prune(at) {
    if (!frames.length) return
    const cutoff = Number(at) - Math.max(1, Number(windowMs) || 20_000)
    while (frames.length > 1 && frames[0].at < cutoff) frames.shift()
    const origin = frames[0].at
    while (events.length && events[0].at < origin) events.shift()
  }

  return {
    record(value, at = now(), { force = false } = {}) {
      at = finiteAt(at, now())
      if (!force && at - lastAt < minIntervalMs) return false
      const clean = sanitizeState(value)
      if (clean == null) return false
      const signature = JSON.stringify(clean)
      if (!force && signature === lastSignature) return false
      frames.push({ at, state: clean })
      lastAt = at
      lastSignature = signature
      prune(at)
      return true
    },

    recordEvent(value, at = now()) {
      at = finiteAt(at, now())
      const clean = sanitizeEvent(value)
      if (!clean || typeof clean !== 'object') return false
      events.push({ ...clean, at, seq: nextSeq++ })
      prune(at)
      return true
    },

    snapshot() {
      if (!frames.length) return { version: 3, durationMs: 1, frames: [], events: [] }
      const origin = frames[0].at
      const normalizedFrames = frames.map((frame) => ({
        t: Math.max(0, Math.round(frame.at - origin)),
        state: frame.state,
      }))
      const normalizedEvents = events
        .filter((event) => event.at >= origin)
        .map(({ at, ...event }) => ({ ...event, t: Math.max(0, Math.round(at - origin)) }))
        .sort(compareEvents)
      const lastTime = Math.max(
        normalizedFrames.at(-1)?.t ?? 0,
        normalizedEvents.at(-1)?.t ?? 0,
      )
      return {
        version: 3,
        durationMs: Math.max(1, lastTime),
        frames: normalizedFrames,
        events: normalizedEvents,
      }
    },

    reset() {
      frames.length = 0
      events.length = 0
      lastAt = -Infinity
      lastSignature = ''
      nextSeq = 0
    },
  }
}

export function encodeDungeonRecording(recording, { maxBytes = DEFAULT_MAX_BYTES } = {}) {
  const limit = Math.max(1, Number(maxBytes) || DEFAULT_MAX_BYTES)
  let candidate = normalizeDungeonRecording(recording)
  let bytes = encode(candidate)

  while (bytes.byteLength > limit && candidate.frames.length > 2) {
    const compacted = [candidate.frames[0]]
    for (let index = 1; index < candidate.frames.length - 1; index += 2) compacted.push(candidate.frames[index])
    compacted.push(candidate.frames.at(-1))
    candidate = { ...candidate, frames: compacted }
    bytes = encode(candidate)
  }

  while (bytes.byteLength > limit && candidate.frames.length > 1) {
    const boundary = candidate.frames[1].t
    candidate = {
      ...candidate,
      frames: candidate.frames.slice(1),
      events: candidate.events.filter((event) => event.t >= boundary),
    }
    candidate = rebase(candidate)
    bytes = encode(candidate)
  }

  if (bytes.byteLength > limit) throw new Error(`replay exceeds ${limit} bytes after compaction`)
  return bytes
}

export function decodeDungeonRecording(bytes) {
  const text = decoder.decode(bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes))
  const parsed = JSON.parse(text)
  return normalizeDungeonRecording(parsed)
}

function normalizeDungeonRecording(recording = {}) {
  const frames = Array.isArray(recording?.frames)
    ? recording.frames
        .filter((frame) => frame && Number.isFinite(Number(frame.t)) && frame.state != null)
        .map((frame) => ({ t: Math.max(0, Math.round(Number(frame.t))), state: frame.state }))
        .sort((left, right) => left.t - right.t)
    : []
  if (!frames.length) throw new Error('replay has no frames')

  const events = Array.isArray(recording?.events)
    ? recording.events
        .filter((event) => event && Number.isFinite(Number(event.t)) && typeof event.type === 'string')
        .map((event, index) => ({
          ...event,
          t: Math.max(0, Math.round(Number(event.t))),
          seq: Number.isFinite(Number(event.seq)) ? Math.max(0, Math.round(Number(event.seq))) : index,
        }))
        .sort(compareEvents)
    : []

  return rebase({
    version: 3,
    durationMs: Math.max(1, Math.round(Number(recording?.durationMs) || 1)),
    frames,
    events,
  })
}

function rebase(recording) {
  if (!recording.frames.length) throw new Error('replay has no frames')
  const offset = recording.frames[0].t
  const frames = recording.frames.map((frame) => ({ ...frame, t: Math.max(0, frame.t - offset) }))
  const events = recording.events
    .filter((event) => event.t >= offset)
    .map((event) => ({ ...event, t: Math.max(0, event.t - offset) }))
    .sort(compareEvents)
  const durationMs = Math.max(1, frames.at(-1)?.t ?? 0, events.at(-1)?.t ?? 0)
  return { version: 3, durationMs, frames, events }
}

function compareEvents(left, right) {
  return left.t - right.t || left.seq - right.seq
}

function finiteAt(value, fallback) {
  const number = Number(value)
  return Number.isFinite(number) ? number : Number(fallback) || 0
}

function encode(value) {
  return encoder.encode(JSON.stringify(value))
}
