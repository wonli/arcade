import { createSnapshotRecorder, encodeCompactRecording, decodeRecording, createCanvasReplayPlayer } from '../../replay/snapshot.js'
import { clearScene, drawFrame, REPLAY_PALETTE } from '../../replay/canvas.js'

export const replay = Object.freeze({
  id: 'snake',
  version: 1,
  createRecorder({ now } = {}) {
    return createSnapshotRecorder({ windowMs: 20_000, minIntervalMs: 120, sanitize: sanitizeState, now })
  },
  encode: encodeCompactRecording,
  decode: decodeRecording,
  createPlayer(target, recording, options = {}) {
    return createCanvasReplayPlayer(target, recording, drawState, options)
  },
})

function sanitizeState(state = {}) {
  if (!Array.isArray(state.snakes)) return null
  return {
    tick: Number(state.tick) || 0,
    food: state.food ? { x: int(state.food.x), y: int(state.food.y) } : null,
    snakes: state.snakes.slice(0, 8).map((snake) => ({
      playerId: String(snake.playerId ?? ''),
      alive: !!snake.alive,
      score: Number(snake.score) || 0,
      body: (snake.body ?? []).slice(0, 240).map((point) => ({ x: int(point.x), y: int(point.y) })),
    })),
  }
}

function drawState(canvas, state = {}) {
  const ctx = clearScene(canvas)
  const columns = 30
  const rows = 20
  const width = Math.min(1080, canvas.width - 120)
  const height = width * rows / columns
  const x = Math.round((canvas.width - width) / 2)
  const y = Math.round((canvas.height - height) / 2)
  drawFrame(ctx, x, y, width, height)
  const cw = width / columns
  const ch = height / rows

  ctx.strokeStyle = '#15191f'
  ctx.lineWidth = 1
  for (let column = 1; column < columns; column += 1) {
    ctx.beginPath(); ctx.moveTo(x + column * cw, y); ctx.lineTo(x + column * cw, y + height); ctx.stroke()
  }
  for (let row = 1; row < rows; row += 1) {
    ctx.beginPath(); ctx.moveTo(x, y + row * ch); ctx.lineTo(x + width, y + row * ch); ctx.stroke()
  }

  state.snakes?.forEach((snake, index) => {
    ctx.fillStyle = REPLAY_PALETTE.players[index % REPLAY_PALETTE.players.length]
    ctx.globalAlpha = snake.alive ? 1 : .28
    snake.body?.forEach((point, pointIndex) => {
      const inset = pointIndex === 0 ? 2 : 4
      ctx.fillRect(x + point.x * cw + inset, y + point.y * ch + inset, Math.max(2, cw - inset * 2), Math.max(2, ch - inset * 2))
    })
  })
  ctx.globalAlpha = 1
  if (state.food) {
    ctx.fillStyle = REPLAY_PALETTE.ink
    ctx.beginPath(); ctx.arc(x + (state.food.x + .5) * cw, y + (state.food.y + .5) * ch, Math.min(cw, ch) * .27, 0, Math.PI * 2); ctx.fill()
  }
}

function int(value) { return Math.round(Number(value) || 0) }
