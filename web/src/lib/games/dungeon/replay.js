import { createSnapshotRecorder, encodeCompactRecording, decodeRecording } from '../../replay/snapshot.js'
import { createSvelteReplayPlayer } from '../../replay/svelte-player.js'

const DUNGEON_WIDTH = 960
const DUNGEON_HEIGHT = 600
const PLAYER_DIRECTIONS = new Set(['up', 'down', 'left', 'right'])

export const replay = Object.freeze({
  id: 'dungeon',
  version: 2,
  normalizePlayers: normalizeDungeonReplayPlayers,
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
  const normalizedWidth = Math.max(1, Number(width) || DUNGEON_WIDTH)
  const normalizedHeight = Math.max(1, Number(height) || DUNGEON_HEIGHT)
  const normalizeX = (value) => clamp01(Number(value ?? 0) / normalizedWidth)
  const normalizeY = (value) => clamp01(Number(value ?? 0) / normalizedHeight)
  const playerEntities = replayPlayerEntities(scene, player)
  if (!playerEntities.length) return null

  const players = playerEntities
    .map((entity, index) => liveReplayPlayer(entity, index, normalizeX, normalizeY))
    .filter(Boolean)
    .sort(compareReplayPlayers)
  if (!players.length) return null

  const localState = scene?.localPlayer?.state ?? playerEntities[0]?.state ?? {}
  const liveProgress = scene?.__infiniteDungeon?.getProgress?.() ?? progress ?? {}
  const normalizedProgress = normalizeProgress(liveProgress, scene)

  return {
    sceneKey: sceneKey(normalizedProgress),
    runSeed: normalizeRunSeed(scene?.__roomGeometry?.runSeed),
    players,
    enemies: (scene?.enemies ?? []).map((enemy, index) => ({
      id: String(enemy?.id ?? `enemy-${index}`).slice(0, 80),
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
    drops: (scene?.drops ?? []).map((drop, index) => ({
      id: replayDropId(drop, index),
      x: normalizeX(drop?.x),
      y: normalizeY(drop?.y),
      item: compactItem(drop?.item),
    })).filter((drop) => drop.item),
    stats: {
      hp: stats?.hp ?? localState.hp ?? 0,
      maxHp: stats?.maxHp ?? localState.maxHp ?? 100,
      kills: stats?.kills ?? scene?.kills ?? 0,
    },
    progress: normalizedProgress,
  }
}

export function normalizeDungeonReplayPlayers(state = {}) {
  const source = Array.isArray(state.players) && state.players.length
    ? state.players
    : state.player
      ? [{
          id: 'player-0',
          slot: 0,
          ...state.player,
          hp: state.player.hp ?? state.stats?.hp,
          maxHp: state.player.maxHp ?? state.stats?.maxHp,
          dead: state.player.dead ?? false,
        }]
      : []

  return source
    .slice(0, 8)
    .map((entry, index) => sanitizeReplayPlayer(entry, index))
    .filter(Boolean)
    .sort(compareReplayPlayers)
}

function replayPlayerEntities(scene, explicitPlayer) {
  if (explicitPlayer?.state) return [explicitPlayer]
  if (scene?.players instanceof Map && scene.players.size) {
    return [...scene.players.values()].filter((entity) => entity?.state)
  }
  return scene?.localPlayer?.state ? [scene.localPlayer] : []
}

function liveReplayPlayer(entity, index, normalizeX, normalizeY) {
  const state = entity?.state
  if (!state) return null
  return {
    id: String(entity.id ?? `player-${index}`).slice(0, 80),
    slot: Number.isInteger(entity.slot) ? entity.slot : index,
    x: normalizeX(state.x),
    y: normalizeY(state.y),
    hp: Math.max(0, int(state.hp)),
    maxHp: Math.max(1, int(state.maxHp) || 100),
    facing: normalizeFacing(entity.facing),
    moving: !!entity.moving,
    attacking: !!entity.attacking,
    dead: !!entity.dead,
  }
}

function sanitizeReplayPlayer(player, index) {
  if (!player || typeof player !== 'object') return null
  return {
    id: String(player.id ?? `player-${index}`).slice(0, 80),
    slot: Number.isInteger(player.slot) ? player.slot : index,
    x: round(player.x),
    y: round(player.y),
    hp: Math.max(0, int(player.hp)),
    maxHp: Math.max(1, int(player.maxHp) || 100),
    facing: normalizeFacing(player.facing),
    moving: !!player.moving,
    attacking: !!player.attacking,
    dead: !!player.dead,
  }
}

function compareReplayPlayers(left, right) {
  const leftSlot = Number.isInteger(left?.slot) ? left.slot : Number.MAX_SAFE_INTEGER
  const rightSlot = Number.isInteger(right?.slot) ? right.slot : Number.MAX_SAFE_INTEGER
  if (leftSlot !== rightSlot) return leftSlot - rightSlot
  return String(left?.id ?? '').localeCompare(String(right?.id ?? ''))
}

function sanitizeState(state = {}) {
  const players = normalizeDungeonReplayPlayers(state)
  if (!players.length) return null

  const progress = normalizeProgress(state.progress)
  return {
    sceneKey: String(state.sceneKey ?? sceneKey(progress)).slice(0, 80),
    runSeed: normalizeRunSeed(state.runSeed),
    players,
    enemies: (state.enemies ?? []).slice(0, 28).map((enemy, index) => ({
      id: String(enemy.id ?? `enemy-${index}`).slice(0, 80),
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
    drops: (state.drops ?? []).slice(0, 18).map((drop, index) => ({
      id: String(drop.id ?? `drop-${index}`).slice(0, 100),
      x: round(drop.x),
      y: round(drop.y),
      item: compactItem(drop.item),
    })).filter((drop) => drop.item),
    stats: {
      hp: int(state.stats?.hp),
      maxHp: Math.max(1, int(state.stats?.maxHp) || 100),
      kills: int(state.stats?.kills),
    },
    progress,
  }
}

function normalizeProgress(progress = {}, scene = null) {
  return {
    floor: Math.max(1, int(progress?.floor ?? scene?.floor) || 1),
    chapter: Math.max(1, int(progress?.chapter) || 1),
    chapterFloor: Math.max(1, int(progress?.chapterFloor ?? progress?.room) || 1),
    roomRole: String(progress?.roomRole ?? 'combat').slice(0, 20),
  }
}

function sceneKey(progress = {}) {
  return `${Math.max(1, int(progress.floor) || 1)}:${Math.max(1, int(progress.chapter) || 1)}:${Math.max(1, int(progress.chapterFloor) || 1)}`
}

function compactItem(item) {
  if (!item || typeof item !== 'object') return null
  const type = String(item.type ?? '').slice(0, 80)
  if (!type) return null
  const result = {
    type,
    rarity: String(item.rarity ?? 'common').slice(0, 20),
  }
  if (item.archetype != null) result.archetype = String(item.archetype).slice(0, 32)
  if (Number.isFinite(Number(item.damage))) result.damage = int(item.damage)
  if (Number.isFinite(Number(item.heal))) result.heal = int(item.heal)
  if (item.name != null) result.name = String(item.name).slice(0, 60)
  if (Number.isFinite(Number(item.level))) result.level = int(item.level)
  if (Array.isArray(item.affixes) && item.affixes.length) {
    result.affixes = item.affixes.slice(0, 6).map((affix) => ({
      id: String(affix?.id ?? '').slice(0, 60),
      value: Number(affix?.value ?? 0),
      tier: Math.max(0, int(affix?.tier)),
    })).filter((affix) => affix.id)
  }
  return result
}

function replayDropId(drop, index) {
  if (drop?.id != null && String(drop.id)) return String(drop.id).slice(0, 100)
  const item = drop?.item ?? {}
  return [
    'drop',
    Math.round(Number(drop?.x) || 0),
    Math.round(Number(drop?.y) || 0),
    String(item.type ?? ''),
    String(item.archetype ?? ''),
    int(item.damage ?? item.heal),
    index,
  ].join(':').slice(0, 100)
}

function normalizeRunSeed(value) {
  const seed = String(value ?? '').trim().toUpperCase()
  return seed ? seed.slice(0, 100) : null
}

function normalizeFacing(value) {
  const facing = String(value ?? 'down')
  return PLAYER_DIRECTIONS.has(facing) ? facing : 'down'
}

function int(value) { return Math.round(Number(value) || 0) }
function round(value) {
  const number = Number(value) || 0
  if (number > 1 || number < 0) return Math.round(number * 100) / 100
  return Math.round(number * 10_000) / 10_000
}
function clamp01(value) { return Math.min(1, Math.max(0, Number(value) || 0)) }
