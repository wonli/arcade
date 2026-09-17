import { createSnapshotRecorder, encodeCompactRecording, decodeRecording, createCanvasReplayPlayer } from '../../replay/snapshot.js'
import { clearScene, drawFrame, occupiedCells } from '../../replay/canvas.js'

export const replay = Object.freeze({
  id: 'tetris',
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

function sanitizeBoard(board) {
  return Array.isArray(board) ? board.map((row) => (row ?? []).map((cell) => Number(cell) || 0)) : []
}

function sanitizeState(state = {}) {
  const board = sanitizeBoard(state.board)
  if (!board.length) return null
  const opponent = state.opponent?.board ? {
    board: sanitizeBoard(state.opponent.board),
    score: Number(state.opponent.score) || 0,
    lines: Number(state.opponent.lines) || 0,
  } : null
  return {
    board,
    score: Number(state.score) || 0,
    lines: Number(state.lines) || 0,
    status: state.status ?? 'playing',
    opponent,
  }
}

function drawState(canvas, state = {}) {
  const ctx = clearScene(canvas)
  const hasOpponent = !!state.opponent?.board?.length
  if (hasOpponent) {
    drawBoard(ctx, state, 330, 80, 280, 560)
    drawBoard(ctx, state.opponent, 750, 150, 210, 420, .78)
    drawScore(ctx, state, 72, 118, 'YOU')
    drawScore(ctx, state.opponent, 1010, 180, 'OPPONENT')
  } else {
    drawBoard(ctx, state, 500, 80, 280, 560)
    drawScore(ctx, state, 820, 136, 'PLAYER')
  }
}

function drawBoard(ctx, state, x, y, width, height, opacity = 1) {
  const rows = state.board?.length || 20
  const columns = state.board?.[0]?.length || 10
  drawFrame(ctx, x, y, width, height)
  const cw = width / columns
  const ch = height / rows
  const colors = { 1:'#c1ff56',2:'#f5ede0',3:'#8ee7ff',4:'#ffcf5a',5:'#ff8db3',6:'#b9a1ff',7:'#ff9f62',8:'#464d57' }
  ctx.save(); ctx.globalAlpha = opacity
  for (const cell of occupiedCells(state.board)) {
    ctx.fillStyle = colors[cell.value] ?? '#c1ff56'
    ctx.fillRect(x + cell.x * cw + 1, y + cell.y * ch + 1, Math.max(1, cw - 2), Math.max(1, ch - 2))
  }
  ctx.restore()
}

function drawScore(ctx, state, x, y, label) {
  ctx.fillStyle = '#69727d'; ctx.font = '800 12px ui-monospace, monospace'; ctx.fillText(label, x, y)
  ctx.fillStyle = '#f4f0e8'; ctx.font = '900 34px ui-monospace, monospace'; ctx.fillText(String(state.score ?? 0), x, y + 42)
  ctx.fillStyle = '#c1ff56'; ctx.font = '800 14px ui-monospace, monospace'; ctx.fillText(`LINES ${state.lines ?? 0}`, x, y + 70)
}
