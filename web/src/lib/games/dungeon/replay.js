import { createSnapshotRecorder, encodeCompactRecording, decodeRecording } from '../../replay/snapshot.js'
import { createSvelteReplayPlayer } from '../../replay/svelte-player.js'

const DUNGEON_WIDTH = 960
const DUNGEON_HEIGHT = 600

export const replay = Object.freeze({
  id: 'dungeon',
  version: 1,
  createRecorder({ now } = {}) {
    return createSnapshotRecorder({ windowMs: 20_000, minIntervalMs: 160, sanitize: sanitizeState, now })
  },
  encode: encodeCompactRecording,
  decode: decodeRecording,
  async createPlayer(target, recording, options = {}) {
    const { default: DungeonReplaySurface } = await import('./DungeonReplaySurface.svelte')
    return createSvelteReplayPlayer(target, recording, DungeonReplaySurface, {
      width: DUNGEON_WIDTH,
      height: DUNGEON_HEIGHT,
      ...options,
    })
  },
})

export function createDungeonReplaySnapshot({ scene, player = null, stats = {}, progress = {}, width = DUNGEON_WIDTH, height = DUNGEON_HEIGHT } = {}) {
  const playerEntity = player ?? scene?.localPlayer
  const playerState = playerEntity?.state
  if (!playerState) return null
  const normalizedWidth = Math.max(1, Number(width) || DUNGEON_WIDTH)
  const normalizedHeight = Math.max(1, Number(height) || DUNGEON_HEIGHT)
  const normalizeX = (value) => clamp01(Number(value ?? 0) / normalizedWidth)
  const normalizeY = (value) => clamp01(Number(value ?? 0) / normalizedHeight)

  return {
    player: {
      x: normalizeX(playerState.x),
      y: normalizeY(playerState.y),
    },
    enemies: (scene?.enemies ?? []).map((enemy) => ({
      x: normalizeX(enemy?.x),
      y: normalizeY(enemy?.y),
      kind: enemy?.boss ? 'boss' : enemy?.elite ? 'elite' : (enemy?.archetype ?? 'skeleton'),
      archetype: enemy?.archetype ?? 'skeleton',
      elite: !!enemy?.elite,
      boss: !!enemy?.boss,
      hp: Number(enemy?.hp ?? 0),
      maxHp: Math.max(1, Number(enemy?.maxHp ?? enemy?.hp ?? 1)),
      alive: Number(enemy?.hp ?? 0) > 0,
    })),
    stats: {
      hp: stats?.hp ?? playerState.hp ?? 0,
      maxHp: stats?.maxHp ?? playerState.maxHp ?? 100,
      kills: stats?.kills ?? scene?.kills ?? 0,
    },
    progress: {
      floor: progress?.floor ?? scene?.floor ?? 1,
      room: progress?.room ?? 1,
      roomRole: progress?.roomRole ?? 'combat',
    },
  }
}

function sanitizeState(state = {}) {
  const player = state.player ? { x: round(state.player.x), y: round(state.player.y) } : null
  if (!player) return null
  return {
    player,
    enemies: (state.enemies ?? []).slice(0, 28).map((enemy) => ({
      x: round(enemy.x),
      y: round(enemy.y),
      kind: String(enemy.kind ?? 'enemy').slice(0, 20),
      archetype: String(enemy.archetype ?? enemy.kind ?? 'skeleton').slice(0, 20),
      elite: !!enemy.elite,
      boss: !!enemy.boss,
      hp: Math.max(0, int(enemy.hp)),
      maxHp: Math.max(1, int(enemy.maxHp) || 1),
      alive: enemy.alive !== false,
    })),
    stats: {
      hp: int(state.stats?.hp),
      maxHp: Math.max(1, int(state.stats?.maxHp) || 100),
      kills: int(state.stats?.kills),
    },
    progress: {
      floor: Math.max(1, int(state.progress?.floor) || 1),
      room: Math.max(1, int(state.progress?.room) || 1),
      roomRole: String(state.progress?.roomRole ?? 'combat').slice(0, 20),
    },
  }
}

function int(value) { return Math.round(Number(value) || 0) }
function round(value) {
  const number = Number(value) || 0
  if (number > 1 || number < 0) return Math.round(number * 100) / 100
  return Math.round(number * 10_000) / 10_000
}
function clamp01(value) { return Math.min(1, Math.max(0, Number(value) || 0)) }
