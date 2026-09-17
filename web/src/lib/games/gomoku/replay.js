import { createSnapshotRecorder, encodeCompactRecording, decodeRecording } from '../../replay/snapshot.js'
import { createSvelteReplayPlayer } from '../../replay/svelte-player.js'

export const replay = Object.freeze({
  id: 'gomoku',
  version: 1,
  createRecorder({ now } = {}) {
    return createSnapshotRecorder({ windowMs: 20_000, sanitize: sanitizeState, now })
  },
  encode: encodeCompactRecording,
  decode: decodeRecording,
  async createPlayer(target, recording, options = {}) {
    const { default: GomokuReplaySurface } = await import('./GomokuReplaySurface.svelte')
    return createSvelteReplayPlayer(target, recording, GomokuReplaySurface, {
      width: 828,
      height: 828,
      ...options,
    })
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
