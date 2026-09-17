import { createSnapshotRecorder, encodeCompactRecording, decodeRecording, createCanvasReplayPlayer } from '../../replay/snapshot.js'
import { clearScene, drawFrame, REPLAY_PALETTE } from '../../replay/canvas.js'

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
  createPlayer(target, recording, options = {}) {
    return createCanvasReplayPlayer(target, recording, drawState, options)
  },
})

export function createDungeonReplaySnapshot({ scene, stats = {}, progress = {}, width = DUNGEON_WIDTH, height = DUNGEON_HEIGHT } = {}) {
  const playerState = scene?.localPlayer?.state
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
      kind: enemy?.boss ? 'boss' : enemy?.elite ? 'elite' : (enemy?.archetype ?? 'enemy'),
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

function drawState(canvas, state = {}) {
  const ctx = clearScene(canvas)
  const width = Math.min(1080, canvas.width - 120)
  const height = Math.min(590, canvas.height - 90)
  const x = Math.round((canvas.width - width) / 2)
  const y = Math.round((canvas.height - height) / 2)
  drawFrame(ctx, x, y, width, height)

  ctx.fillStyle = '#15191d'
  for (let column = 0; column < 12; column += 1) {
    for (let row = 0; row < 7; row += 1) {
      if ((column + row) % 2) ctx.fillRect(x + column * width / 12, y + row * height / 7, width / 12, height / 7)
    }
  }

  const sx = (value) => x + Math.min(1, Math.max(0, value)) * width
  const sy = (value) => y + Math.min(1, Math.max(0, value)) * height
  for (const enemy of state.enemies ?? []) {
    ctx.globalAlpha = enemy.alive === false ? .25 : 1
    ctx.fillStyle = enemy.kind === 'boss' ? '#ff5d5d' : enemy.kind === 'elite' ? '#ffcf5a' : '#f4f0e8'
    ctx.beginPath(); ctx.arc(sx(enemy.x), sy(enemy.y), enemy.kind === 'boss' ? 18 : 11, 0, Math.PI * 2); ctx.fill()
  }
  ctx.globalAlpha = 1
  ctx.fillStyle = REPLAY_PALETTE.accent
  ctx.beginPath(); ctx.arc(sx(state.player?.x ?? .5), sy(state.player?.y ?? .5), 13, 0, Math.PI * 2); ctx.fill()
  ctx.strokeStyle = '#0b0d10'; ctx.lineWidth = 3; ctx.stroke()

  const hpRatio = Math.min(1, Math.max(0, (state.stats?.hp ?? 0) / Math.max(1, state.stats?.maxHp ?? 1)))
  ctx.fillStyle = '#252b32'; ctx.fillRect(x + 20, y + 20, 220, 10)
  ctx.fillStyle = '#c1ff56'; ctx.fillRect(x + 20, y + 20, 220 * hpRatio, 10)
  ctx.fillStyle = '#69727d'; ctx.font = '800 12px ui-monospace, monospace'
  ctx.fillText(`FLOOR ${state.progress?.floor ?? 1}  ·  ROOM ${state.progress?.room ?? 1}  ·  KILLS ${state.stats?.kills ?? 0}`, x + 20, y + 52)
}

function int(value) { return Math.round(Number(value) || 0) }
function round(value) {
  const number = Number(value) || 0
  if (number > 1 || number < 0) return Math.round(number * 100) / 100
  return Math.round(number * 10_000) / 10_000
}
function clamp01(value) { return Math.min(1, Math.max(0, Number(value) || 0)) }
