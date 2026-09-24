import { createSnapshotRecorder, encodeCompactRecording, decodeRecording } from '../../replay/snapshot.js'
import { createSvelteReplayPlayer } from '../../replay/svelte-player.js'

export const replay = Object.freeze({
  id: 'tank',
  version: 1,
  createRecorder({ now } = {}) {
    return createSnapshotRecorder({ windowMs: 30_000, minIntervalMs: 100, sanitize: sanitizeState, now })
  },
  encode: encodeCompactRecording,
  decode: decodeRecording,
  async createPlayer(target, recording, options = {}) {
    const { default: TankReplaySurface } = await import('./TankReplaySurface.svelte')
    return createSvelteReplayPlayer(target, recording, TankReplaySurface, {
      width: 1164,
      height: 700,
      ...options,
    })
  },
})

function sanitizeState(state = {}) {
  if (!Array.isArray(state.tanks)) return null
  return {
    width: number(state.width),
    height: number(state.height),
    tick: integer(state.tick),
    round: integer(state.round),
    roundResetTicks: integer(state.roundResetTicks),
    targetScore: integer(state.targetScore) || 5,
    status: String(state.status ?? ''),
    winner: String(state.winner ?? ''),
    obstacles: (state.obstacles ?? []).slice(0, 32).map((item) => ({
      x: number(item.x), y: number(item.y), w: number(item.w), h: number(item.h),
    })),
    tanks: state.tanks.slice(0, 2).map((tank) => ({
      playerId: String(tank.playerId ?? ''),
      name: String(tank.name ?? '').slice(0, 40),
      x: number(tank.x), y: number(tank.y), angle: number(tank.angle), turretAngle: number(tank.turretAngle),
      hp: integer(tank.hp), alive: !!tank.alive, score: integer(tank.score),
    })),
    bullets: (state.bullets ?? []).slice(0, 32).map((bullet) => ({
      id: integer(bullet.id), ownerId: String(bullet.ownerId ?? ''),
      x: number(bullet.x), y: number(bullet.y), vx: number(bullet.vx), vy: number(bullet.vy),
    })),
  }
}

function number(value) { return Number(value) || 0 }
function integer(value) { return Math.round(Number(value) || 0) }
