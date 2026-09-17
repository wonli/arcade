import { createSnapshotRecorder, encodeCompactRecording, decodeRecording, createCanvasReplayPlayer } from '../../replay/snapshot.js'
import { clearScene, drawFrame } from '../../replay/canvas.js'

export const replay = Object.freeze({
  id: 'drawguess',
  version: 1,
  createRecorder({ now } = {}) {
    return createSnapshotRecorder({ windowMs: 20_000, minIntervalMs: 80, sanitize: sanitizeState, now })
  },
  encode: encodeCompactRecording,
  decode: decodeRecording,
  createPlayer(target, recording, options = {}) {
    return createCanvasReplayPlayer(target, recording, drawState, options)
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

function drawState(canvas, state = {}) {
  const ctx = clearScene(canvas)
  const width = Math.min(1080, canvas.width - 110)
  const height = Math.min(580, canvas.height - 100)
  const x = Math.round((canvas.width - width) / 2)
  const y = Math.round((canvas.height - height) / 2)
  drawFrame(ctx, x, y, width, height)
  ctx.fillStyle = '#f7f4ed'
  ctx.fillRect(x + 2, y + 2, width - 4, height - 4)

  for (const stroke of state.strokes ?? []) {
    const points = stroke.points ?? []
    if (points.length < 2) continue
    ctx.save()
    ctx.globalCompositeOperation = stroke.eraser ? 'destination-out' : 'source-over'
    ctx.strokeStyle = stroke.color || '#111111'
    ctx.lineWidth = Math.max(2, stroke.width * width / 800)
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    ctx.beginPath()
    ctx.moveTo(x + points[0].x * width, y + points[0].y * height)
    for (let index = 1; index < points.length; index += 1) ctx.lineTo(x + points[index].x * width, y + points[index].y * height)
    ctx.stroke()
    ctx.restore()
  }
}

function round(value) { return Math.round(Math.min(1, Math.max(0, Number(value) || 0)) * 10_000) / 10_000 }
