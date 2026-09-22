import { createSnapshotRecorder, encodeCompactRecording, decodeRecording } from '../../replay/snapshot.js'
import { createSvelteReplayPlayer } from '../../replay/svelte-player.js'

export const replay = Object.freeze({
  id: 'policethief',
  version: 1,
  createRecorder({ now } = {}) {
    return createSnapshotRecorder({ windowMs: 20_000, sanitize: sanitizeState, now })
  },
  encode: encodeCompactRecording,
  decode: decodeRecording,
  async createPlayer(target, recording, options = {}) {
    const { default: PoliceThiefReplaySurface } = await import('./PoliceThiefReplaySurface.svelte')
    return createSvelteReplayPlayer(target, recording, PoliceThiefReplaySurface, {
      width: 828,
      height: 828,
      ...options,
    })
  },
})

function sanitizeState(state = {}) {
  if (!state.thief || !state.police) return null
  return {
    thief: String(state.thief),
    police: String(state.police),
    turn: state.turn === 'police' ? 'police' : 'thief',
    winner: state.winner === 'police' ? 'police' : '',
    moves: Number(state.moves) || 0,
    status: state.status === 'finished' ? 'finished' : 'playing',
    last: state.last ? {
      role: state.last.role === 'police' ? 'police' : 'thief',
      from: String(state.last.from ?? ''),
      to: String(state.last.to ?? ''),
    } : null,
  }
}
