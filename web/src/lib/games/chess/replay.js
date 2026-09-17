import { createSnapshotRecorder, encodeCompactRecording, decodeRecording } from '../../replay/snapshot.js'
import { createSvelteReplayPlayer } from '../../replay/svelte-player.js'
import ChessReplaySurface from './ChessReplaySurface.svelte'

export const replay = Object.freeze({
  id: 'chess',
  version: 1,
  createRecorder({ now } = {}) {
    return createSnapshotRecorder({ windowMs: 20_000, sanitize: sanitizeState, now })
  },
  encode: encodeCompactRecording,
  decode: decodeRecording,
  createPlayer(target, recording, options = {}) {
    return createSvelteReplayPlayer(target, recording, ChessReplaySurface, {
      width: 740,
      height: 740,
      ...options,
    })
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
    last: state.last ? {
      from: { x: Number(state.last.from?.x) || 0, y: Number(state.last.from?.y) || 0 },
      to: { x: Number(state.last.to?.x) || 0, y: Number(state.last.to?.y) || 0 },
    } : null,
  }
}
