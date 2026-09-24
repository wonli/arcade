import { createSnapshotRecorder, encodeCompactRecording, decodeRecording } from '../../replay/snapshot.js'
import { createSvelteReplayPlayer } from '../../replay/svelte-player.js'

const ROWS = 10
const COLS = 9

export const replay = Object.freeze({
  id: 'xiangqi',
  version: 1,
  createRecorder({ now } = {}) {
    return createSnapshotRecorder({ windowMs: 20_000, sanitize: sanitizeState, now })
  },
  encode: encodeCompactRecording,
  decode: decodeRecording,
  async createPlayer(target, recording, options = {}) {
    const { default: XiangqiReplaySurface } = await import('./XiangqiReplaySurface.svelte')
    return createSvelteReplayPlayer(target, recording, XiangqiReplaySurface, {
      width: 740,
      height: 840,
      ...options,
    })
  },
})

function sanitizeState(state = {}) {
  if (!Array.isArray(state.board) || state.board.length !== ROWS) return null
  const board = state.board.map((row) => {
    if (!Array.isArray(row) || row.length !== COLS) return null
    return row.map((cell) => {
      const piece = Number(cell)
      return Number.isInteger(piece) && Math.abs(piece) <= 7 ? piece : 0
    })
  })
  if (board.some((row) => row == null)) return null

  return {
    board,
    ply: Math.max(0, Number(state.ply) || 0),
    turn: state.turn === 'black' ? 'black' : 'red',
    check: !!state.check,
    status: state.status === 'finished' ? 'finished' : 'playing',
    winner: state.winner === 'red' || state.winner === 'black' ? state.winner : '',
    last: sanitizeMove(state.last),
    drawReason: typeof state.drawReason === 'string' ? state.drawReason : '',
  }
}

function sanitizeMove(move) {
  if (!move?.from || !move?.to) return null
  return {
    from: {
      x: coordinate(move.from.x, 0, COLS - 1),
      y: coordinate(move.from.y, 0, ROWS - 1),
    },
    to: {
      x: coordinate(move.to.x, 0, COLS - 1),
      y: coordinate(move.to.y, 0, ROWS - 1),
    },
  }
}

function coordinate(value, min, max) {
  const number = Number(value)
  if (!Number.isInteger(number)) return min
  return Math.min(max, Math.max(min, number))
}
