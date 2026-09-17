import { createSnapshotRecorder, encodeCompactRecording, decodeRecording, createCanvasReplayPlayer } from '../../replay/snapshot.js'
import { clearScene, drawFrame, occupiedCells } from '../../replay/canvas.js'

export const replay = Object.freeze({
  id: 'chess',
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
    ply: Number(state.ply) || 0,
    turn: state.turn === 'black' ? 'black' : 'white',
    check: !!state.check,
    status: state.status === 'finished' ? 'finished' : 'playing',
    winner: state.winner ?? '',
  }
}

function drawState(canvas, state = {}) {
  const ctx = clearScene(canvas)
  const boardSize = Math.min(592, canvas.height - 96)
  const x = Math.round((canvas.width - boardSize) / 2)
  const y = Math.round((canvas.height - boardSize) / 2)
  const cell = boardSize / 8
  const letters = { 1: 'P', 2: 'N', 3: 'B', 4: 'R', 5: 'Q', 6: 'K' }

  drawFrame(ctx, x, y, boardSize, boardSize)
  for (let row = 0; row < 8; row += 1) for (let column = 0; column < 8; column += 1) {
    ctx.fillStyle = (row + column) % 2 ? '#68745d' : '#d9d1bd'
    ctx.fillRect(x + column * cell, y + row * cell, cell, cell)
  }

  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.font = '900 30px ui-monospace, monospace'
  for (const piece of occupiedCells(state.board)) {
    const cx = x + (piece.x + .5) * cell
    const cy = y + (piece.y + .5) * cell
    ctx.beginPath(); ctx.arc(cx, cy, cell * .32, 0, Math.PI * 2)
    ctx.fillStyle = piece.value > 0 ? '#f4f0e8' : '#17191c'; ctx.fill()
    ctx.strokeStyle = piece.value > 0 ? '#343a42' : '#f4f0e8'; ctx.lineWidth = 2; ctx.stroke()
    ctx.fillStyle = piece.value > 0 ? '#17191c' : '#f4f0e8'
    ctx.fillText(letters[Math.abs(piece.value)] ?? '?', cx, cy + 1)
  }
  ctx.textAlign = 'start'
  ctx.textBaseline = 'alphabetic'
}
