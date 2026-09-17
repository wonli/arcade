import { createSnapshotRecorder, encodeCompactRecording, decodeRecording } from '../../replay/snapshot.js'
import { createSvelteReplayPlayer } from '../../replay/svelte-player.js'
import TetrisReplaySurface from './TetrisReplaySurface.svelte'

export const replay = Object.freeze({
  id: 'tetris',
  version: 1,
  createRecorder({ now } = {}) {
    return createSnapshotRecorder({ windowMs: 20_000, minIntervalMs: 120, sanitize: sanitizeState, now })
  },
  encode: encodeCompactRecording,
  decode: decodeRecording,
  createPlayer(target, recording, options = {}) {
    return createSvelteReplayPlayer(target, recording, TetrisReplaySurface, {
      width: 590,
      height: 700,
      ...options,
    })
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
    nextBoard: sanitizeBoard(state.nextBoard),
    score: Number(state.score) || 0,
    lines: Number(state.lines) || 0,
    status: state.status ?? 'playing',
    opponent,
  }
}
