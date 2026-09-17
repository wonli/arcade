import { createSnapshotRecorder, encodeCompactRecording, decodeRecording, createCanvasReplayPlayer } from '../../replay/snapshot.js'
import { clearScene, drawFrame, occupiedCells } from '../../replay/canvas.js'

export const replay = Object.freeze({
  id: 'gomoku',
  version: 1,
  createRecorder({ now } = {}) {
    return createSnapshotRecorder({ windowMs: 20_000, sanitize: sanitizeState, now })
  },
  encode: encodeCompactRecording,
  decode: decodeRecording,
  createPlayer(target, recording, options = {}) {
    return createCanvasReplayPlayer(target, recording, drawState, options)
  },
})

function sanitizeState(state = {}) {
  if (!Array.isArray(state.board)) return null
  return {
    board: state.board.map((row) => (row ?? []).map((cell) => Number(cell) || 0)),
    moves: Number(state.moves) || 0,
    turn: Number(state.turn) || 0,
    status: state.status === 'finished' ? 'finished' : 'playing',
    winner: Number(state.winner) || 0,
    last: state.last ? { x: Number(state.last.x) || 0, y: Number(state.last.y) || 0 } : null,
  }
}

function drawState(canvas, state = {}) {
  const ctx = clearScene(canvas)
  const size = state.board?.length || 15
  const boardSize = Math.min(590, canvas.height - 100)
  const x = Math.round((canvas.width - boardSize) / 2)
  const y = Math.round((canvas.height - boardSize) / 2)
  drawFrame(ctx, x, y, boardSize, boardSize)

  const inset = 30
  const gap = (boardSize - inset * 2) / Math.max(1, size - 1)
  ctx.strokeStyle = '#4d5660'
  ctx.lineWidth = 1
  for (let index = 0; index < size; index += 1) {
    const offset = inset + index * gap
    ctx.beginPath(); ctx.moveTo(x + inset, y + offset); ctx.lineTo(x + boardSize - inset, y + offset); ctx.stroke()
    ctx.beginPath(); ctx.moveTo(x + offset, y + inset); ctx.lineTo(x + offset, y + boardSize - inset); ctx.stroke()
  }

  for (const stone of occupiedCells(state.board)) {
    const cx = x + inset + stone.x * gap
    const cy = y + inset + stone.y * gap
    ctx.beginPath()
    ctx.arc(cx, cy, Math.max(8, gap * 0.38), 0, Math.PI * 2)
    ctx.fillStyle = stone.value === 1 ? '#080a0d' : '#f4f0e8'
    ctx.fill()
    ctx.strokeStyle = stone.value === 1 ? '#3a414a' : '#a8a49c'
    ctx.stroke()
    if (state.last?.x === stone.x && state.last?.y === stone.y) {
      ctx.beginPath(); ctx.arc(cx, cy, Math.max(2.5, gap * .08), 0, Math.PI * 2); ctx.fillStyle = '#c1ff56'; ctx.fill()
    }
  }
}
