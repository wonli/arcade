export function createDungeonReplayDriver({
  recording,
  scene,
  now = () => performance.now(),
  requestFrame = (callback) => requestAnimationFrame(callback),
  cancelFrame = (id) => cancelAnimationFrame(id),
  loop = true,
} = {}) {
  const timeline = normalizeRecording(recording)
  if (!scene?.applyReplayState || !scene?.presentEvent) throw new TypeError('Replay scene must expose applyReplayState and presentEvent')

  let playing = false
  let destroyed = false
  let frameRequest = null
  let position = 0
  let previousPosition = -1
  let wallOrigin = 0

  function applyAt(nextPosition, { seeking = false } = {}) {
    if (destroyed) return false
    const duration = timeline.durationMs
    let target = clamp(nextPosition, 0, duration)
    if (seeking || target < position) {
      scene.resetReplayTransient?.()
      const base = frameAtOrBefore(timeline.frames, target)
      scene.applyReplayState(stateAt(timeline, target))
      const start = base?.t ?? 0
      for (const event of eventsBetween(timeline, start - 1, target)) scene.presentEvent(event)
      previousPosition = target
      position = target
      return true
    }

    scene.applyReplayState(stateAt(timeline, target))
    for (const event of eventsBetween(timeline, previousPosition, target)) scene.presentEvent(event)
    previousPosition = target
    position = target
    return true
  }

  function schedule() {
    if (!playing || destroyed || frameRequest != null) return
    frameRequest = requestFrame(tick)
  }

  function tick() {
    frameRequest = null
    if (!playing || destroyed) return
    let target = Math.max(0, now() - wallOrigin)
    if (target >= timeline.durationMs) {
      applyAt(timeline.durationMs)
      if (!loop) {
        playing = false
        return
      }
      scene.resetReplayTransient?.()
      position = 0
      previousPosition = -1
      wallOrigin = now()
      applyAt(0, { seeking: true })
      schedule()
      return
    }
    applyAt(target)
    schedule()
  }

  function play() {
    if (destroyed || playing) return false
    playing = true
    wallOrigin = now() - position
    if (previousPosition < 0) applyAt(position, { seeking: true })
    schedule()
    return true
  }

  function pause() {
    if (!playing) return false
    position = clamp(now() - wallOrigin, 0, timeline.durationMs)
    playing = false
    if (frameRequest != null) cancelFrame(frameRequest)
    frameRequest = null
    return true
  }

  function seek(value) {
    const target = clamp(Number(value) || 0, 0, timeline.durationMs)
    applyAt(target, { seeking: true })
    if (playing) wallOrigin = now() - target
    return target
  }

  function destroy() {
    if (destroyed) return
    playing = false
    destroyed = true
    if (frameRequest != null) cancelFrame(frameRequest)
    frameRequest = null
    scene.resetReplayTransient?.()
  }

  return {
    play,
    pause,
    seek,
    destroy,
    getPosition: () => position,
    getDuration: () => timeline.durationMs,
    isPlaying: () => playing,
  }
}

export function stateAt(recording, time) {
  const timeline = normalizeRecording(recording)
  const target = clamp(Number(time) || 0, 0, timeline.durationMs)
  const frames = timeline.frames
  if (frames.length === 1 || target <= frames[0].t) return clone(frames[0].state)
  const previous = frameAtOrBefore(frames, target)
  const index = frames.indexOf(previous)
  const next = frames[Math.min(frames.length - 1, index + 1)]
  if (!next || next === previous || next.t <= previous.t) return clone(previous.state)
  const alpha = clamp((target - previous.t) / (next.t - previous.t), 0, 1)
  return interpolateState(previous.state, next.state, alpha)
}

export function eventsBetween(recording, afterTime, throughTime) {
  const timeline = normalizeRecording(recording)
  const after = Number(afterTime)
  const through = Number(throughTime)
  if (!Number.isFinite(through) || through < after) return []
  return timeline.events.filter((event) => event.t > after && event.t <= through).map(clone)
}

function interpolateState(previous = {}, next = {}, alpha) {
  return {
    ...clone(previous),
    scene: clone(previous.scene ?? next.scene ?? {}),
    stats: clone(previous.stats ?? next.stats ?? {}),
    players: interpolateEntities(previous.players, next.players, alpha),
    enemies: interpolateEntities(previous.enemies, next.enemies, alpha),
    drops: clone(previous.drops ?? []),
    projectiles: interpolateEntities(previous.projectiles, next.projectiles, alpha),
  }
}

function interpolateEntities(previous = [], next = [], alpha) {
  const nextById = new Map((next ?? []).map((entry) => [String(entry?.id ?? ''), entry]))
  return (previous ?? []).map((entry) => {
    const nextEntry = nextById.get(String(entry?.id ?? ''))
    if (!nextEntry) return clone(entry)
    return {
      ...clone(entry),
      x: lerp(entry.x, nextEntry.x, alpha),
      y: lerp(entry.y, nextEntry.y, alpha),
    }
  })
}

function frameAtOrBefore(frames, time) {
  let result = frames[0]
  for (const frame of frames) {
    if (frame.t > time) break
    result = frame
  }
  return result
}

function normalizeRecording(recording = {}) {
  const frames = Array.isArray(recording.frames)
    ? recording.frames.filter((frame) => frame?.state && Number.isFinite(Number(frame.t))).map((frame) => ({ t: Math.max(0, Number(frame.t)), state: frame.state })).sort((a, b) => a.t - b.t)
    : []
  if (!frames.length) throw new Error('Dungeon replay has no frames')
  const events = Array.isArray(recording.events)
    ? recording.events.filter((event) => event?.type && Number.isFinite(Number(event.t))).map((event, index) => ({ ...event, t: Math.max(0, Number(event.t)), seq: Number.isFinite(Number(event.seq)) ? Number(event.seq) : index })).sort((a, b) => a.t - b.t || a.seq - b.seq)
    : []
  const durationMs = Math.max(1, Number(recording.durationMs) || frames.at(-1).t || events.at(-1)?.t || 1)
  return { version: 3, durationMs, frames, events }
}

function lerp(left, right, alpha) {
  const a = Number(left)
  const b = Number(right)
  if (!Number.isFinite(a) || !Number.isFinite(b)) return Number.isFinite(a) ? a : Number.isFinite(b) ? b : 0
  return a + (b - a) * alpha
}

function clone(value) { return structuredClone(value ?? null) }
function clamp(value, min, max) { return Math.min(max, Math.max(min, value)) }
