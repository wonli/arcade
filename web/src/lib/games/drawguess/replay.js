import { createSnapshotRecorder, encodeCompactRecording, decodeRecording } from '../../replay/snapshot.js'
import { createSvelteReplayPlayer } from '../../replay/svelte-player.js'
import DrawReplaySurface from './DrawReplaySurface.svelte'

export const replay = Object.freeze({
  id: 'drawguess',
  version: 1,
  createRecorder({ now } = {}) {
    return createSnapshotRecorder({ windowMs: 20_000, minIntervalMs: 80, sanitize: sanitizeState, now })
  },
  encode: encodeCompactRecording,
  decode: decodeRecording,
  createPlayer(target, recording, options = {}) {
    return createSvelteReplayPlayer(target, recording, DrawReplaySurface, {
      width: 960,
      height: 600,
      ...options,
    })
  },
})

function sanitizeState(state = {}) {
  const strokes = compactStrokes(state.strokes ?? [])
  return {
    round: Number(state.round) || 0,
    totalRounds: Number(state.totalRounds) || 0,
    strokes,
  }
}

function compactStrokes(strokes) {
  const result = []
  let remainingPoints = 1_400
  for (let index = strokes.length - 1; index >= 0 && remainingPoints > 0; index -= 1) {
    const stroke = strokes[index] ?? {}
    const rawPoints = Array.isArray(stroke.points) ? stroke.points : []
    if (rawPoints.length < 2) continue
    const take = Math.min(rawPoints.length, remainingPoints, 240)
    const points = rawPoints.slice(-take).map((point) => ({ x: round(point.x), y: round(point.y) }))
    remainingPoints -= points.length
    result.push({
      color: /^#[0-9a-f]{6}$/i.test(stroke.color ?? '') ? stroke.color : '#111111',
      width: Math.max(2, Math.min(24, Number(stroke.width) || 6)),
      eraser: !!stroke.eraser,
      points,
    })
  }
  return result.reverse()
}

function round(value) { return Math.round(Math.min(1, Math.max(0, Number(value) || 0)) * 10_000) / 10_000 }
