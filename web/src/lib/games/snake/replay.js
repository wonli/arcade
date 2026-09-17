import { createSnapshotRecorder, encodeCompactRecording, decodeRecording } from '../../replay/snapshot.js'
import { createSvelteReplayPlayer } from '../../replay/svelte-player.js'

export const replay = Object.freeze({
  id: 'snake',
  version: 1,
  createRecorder({ now } = {}) {
    return createSnapshotRecorder({ windowMs: 20_000, minIntervalMs: 120, sanitize: sanitizeState, now })
  },
  encode: encodeCompactRecording,
  decode: decodeRecording,
  async createPlayer(target, recording, options = {}) {
    const { default: SnakeReplaySurface } = await import('./SnakeReplaySurface.svelte')
    return createSvelteReplayPlayer(target, recording, SnakeReplaySurface, {
      width: 1164,
      height: 640,
      ...options,
    })
  },
})

function sanitizeState(state = {}) {
  if (!Array.isArray(state.snakes)) return null
  return {
    tick: Number(state.tick) || 0,
    food: state.food ? { x: int(state.food.x), y: int(state.food.y) } : null,
    snakes: state.snakes.slice(0, 8).map((snake) => ({
      playerId: String(snake.playerId ?? ''),
      name: String(snake.name ?? '').slice(0, 40),
      alive: !!snake.alive,
      score: Number(snake.score) || 0,
      body: (snake.body ?? []).slice(0, 240).map((point) => ({ x: int(point.x), y: int(point.y) })),
    })),
  }
}

function int(value) { return Math.round(Number(value) || 0) }
