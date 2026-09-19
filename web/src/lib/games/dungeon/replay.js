import {
  createDungeonReplayRecorder,
  encodeDungeonRecording,
  decodeDungeonRecording,
} from './replay-recording.js'
import { createSvelteReplayPlayer } from '../../replay/svelte-player.js'
import { currentEffects, currentWeapon } from './player-loadout.js'

const DUNGEON_WIDTH = 960
const DUNGEON_HEIGHT = 600
const PLAYER_DIRECTIONS = new Set(['up', 'down', 'left', 'right'])
const projectileIds = new WeakMap()
let nextProjectileId = 0

export const replay = Object.freeze({
  id: 'dungeon',
  version: 3,
  normalizePlayers: normalizeDungeonReplayPlayers,
  createRecorder({ now } = {}) {
    return createDungeonReplayRecorder({
      windowMs: 20_000,
      minIntervalMs: 160,
      sanitizeState,
      sanitizeEvent,
      now,
    })
  },
  encode: encodeDungeonRecording,
  decode: decodeDungeonRecording,
  async createPlayer(target, recording, options = {}) {
    const { default: DungeonReplaySurface } = await import('./DungeonReplaySurface.svelte')
    return createSvelteReplayPlayer(target, recording, DungeonReplaySurface, {
      width: DUNGEON_WIDTH,
      height: DUNGEON_HEIGHT,
      ...options,
      componentOwnsTimeline: true,
    })
  },
})

export function captureDungeonReplayState({ scene, player = null, stats = {}, progress = {} } = {}) {
  const playerEntities = replayPlayerEntities(scene, player)
  if (!playerEntities.length) return null

  const players = playerEntities
    .map((entity, index) => liveReplayPlayer(entity, index))
    .filter(Boolean)
    .sort(compareReplayPlayers)
  if (!players.length) return null

  const localState = playerEntities[0]?.state ?? {}
  const liveProgress = scene?.__infiniteDungeon?.getProgress?.() ?? progress ?? {}
  const normalizedProgress = normalizeProgress(liveProgress, scene)
  const roomGeometry = scene?.__roomGeometry ?? {}

  return sanitizeState({
    scene: {
      floor: normalizedProgress.floor,
      chapter: normalizedProgress.chapter,
      chapterFloor: normalizedProgress.chapterFloor,
      roomRole: normalizedProgress.roomRole,
      sceneKey: sceneKey(normalizedProgress),
      runSeed: normalizeRunSeed(roomGeometry.runSeed),
      roomTemplate: roomTemplate(roomGeometry),
      portal: compactPortal(scene?.portal),
    },
    players,
    enemies: (scene?.enemies ?? []).map((enemy, index) => liveReplayEnemy(enemy, index)),
    drops: (scene?.drops ?? []).map((drop, index) => ({
      id: replayDropId(drop, index),
      x: roundWorld(drop?.x),
      y: roundWorld(drop?.y),
      item: compactItem(drop?.item),
    })).filter((drop) => drop.item),
    projectiles: replayProjectiles(scene),
    stats: {
      hp: stats?.hp ?? localState.hp ?? 0,
      maxHp: stats?.maxHp ?? localState.maxHp ?? 100,
      kills: stats?.kills ?? scene?.kills ?? 0,
    },
  })
}

export function normalizeDungeonReplayPlayers(state = {}) {
  const source = Array.isArray(state.players) ? state.players : []
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
  return []
}

function liveReplayPlayer(entity, index) {
  const state = entity?.state
  if (!state) return null
  return sanitizeReplayPlayer({
    id: entity.id ?? `player-${index}`,
    slot: Number.isInteger(entity.slot) ? entity.slot : index,
    x: state.x,
    y: state.y,
    hp: state.hp,
    maxHp: state.maxHp,
    facing: entity.facing,
    moving: entity.moving,
    attacking: entity.attacking,
    dead: entity.dead,
    weapon: currentWeapon(state),
    effects: currentEffects(state),
  }, index)
}

function sanitizeReplayPlayer(player, index) {
  if (!player || typeof player !== 'object') return null
  return {
    id: String(player.id ?? `player-${index}`).slice(0, 80),
    slot: Number.isInteger(player.slot) ? player.slot : index,
    x: roundWorld(player.x),
    y: roundWorld(player.y),
    hp: Math.max(0, int(player.hp)),
    maxHp: Math.max(1, int(player.maxHp) || 100),
    facing: normalizeFacing(player.facing),
    moving: !!player.moving,
    attacking: !!player.attacking,
    dead: !!player.dead,
    weapon: compactItem(player.weapon),
    effects: compactEffects(player.effects),
  }
}

function liveReplayEnemy(enemy, index) {
  return {
    id: String(enemy?.id ?? `enemy-${index}`).slice(0, 80),
    x: roundWorld(enemy?.x),
    y: roundWorld(enemy?.y),
    hp: Math.max(0, int(enemy?.hp)),
    maxHp: Math.max(1, int(enemy?.maxHp ?? enemy?.hp) || 1),
    archetype: String(enemy?.archetype ?? 'skeleton').slice(0, 32),
    elite: !!enemy?.elite,
    boss: !!enemy?.boss,
    phase: compactScalar(enemy?.phase),
    facing: normalizeOptionalFacing(enemy?.facing),
    moving: !!enemy?.moving,
    dead: enemy?.dead === true || Number(enemy?.hp ?? 0) <= 0,
  }
}

function replayProjectiles(scene) {
  const source = Array.isArray(scene?.enemyProjectiles)
    ? scene.enemyProjectiles
    : Array.isArray(scene?.projectiles) ? scene.projectiles : []
  return source.slice(0, 64).map((projectile, index) => ({
    id: stableProjectileId(projectile, index),
    kind: String(projectile?.kind ?? 'enemy').slice(0, 32),
    ownerId: String(projectile?.ownerId ?? '').slice(0, 80),
    x: roundWorld(projectile?.x),
    y: roundWorld(projectile?.y),
    vx: roundWorld(projectile?.vx),
    vy: roundWorld(projectile?.vy),
  }))
}

function stableProjectileId(projectile, index) {
  const explicit = String(projectile?.id ?? '').trim()
  if (explicit) return explicit.slice(0, 100)
  if (!projectile || typeof projectile !== 'object') return `projectile:${index}`
  let id = projectileIds.get(projectile)
  if (!id) {
    id = `projectile:${++nextProjectileId}`
    projectileIds.set(projectile, id)
  }
  return id
}

function sanitizeState(state = {}) {
  const players = normalizeDungeonReplayPlayers(state)
  if (!players.length) return null
  const rawScene = state.scene ?? {}
  const progress = normalizeProgress(rawScene)
  const scene = {
    floor: progress.floor,
    chapter: progress.chapter,
    chapterFloor: progress.chapterFloor,
    roomRole: progress.roomRole,
    sceneKey: String(rawScene.sceneKey ?? sceneKey(progress)).slice(0, 80),
    runSeed: normalizeRunSeed(rawScene.runSeed),
    roomTemplate: String(rawScene.roomTemplate ?? '').slice(0, 80) || null,
    portal: compactPortal(rawScene.portal),
  }
  return {
    scene,
    players,
    enemies: (state.enemies ?? []).slice(0, 40).map((enemy, index) => ({
      id: String(enemy?.id ?? `enemy-${index}`).slice(0, 80),
      x: roundWorld(enemy?.x),
      y: roundWorld(enemy?.y),
      hp: Math.max(0, int(enemy?.hp)),
      maxHp: Math.max(1, int(enemy?.maxHp ?? enemy?.hp) || 1),
      archetype: String(enemy?.archetype ?? 'skeleton').slice(0, 32),
      elite: !!enemy?.elite,
      boss: !!enemy?.boss,
      phase: compactScalar(enemy?.phase),
      facing: normalizeOptionalFacing(enemy?.facing),
      moving: !!enemy?.moving,
      dead: enemy?.dead === true || Number(enemy?.hp ?? 0) <= 0,
    })),
    drops: (state.drops ?? []).slice(0, 24).map((drop, index) => ({
      id: String(drop?.id ?? `drop-${index}`).slice(0, 100),
      x: roundWorld(drop?.x),
      y: roundWorld(drop?.y),
      item: compactItem(drop?.item),
    })).filter((drop) => drop.item),
    projectiles: (state.projectiles ?? []).slice(0, 64).map((projectile, index) => ({
      id: String(projectile?.id ?? `projectile:${index}`).slice(0, 100),
      kind: String(projectile?.kind ?? 'enemy').slice(0, 32),
      ownerId: String(projectile?.ownerId ?? '').slice(0, 80),
      x: roundWorld(projectile?.x),
      y: roundWorld(projectile?.y),
      vx: roundWorld(projectile?.vx),
      vy: roundWorld(projectile?.vy),
    })),
    stats: {
      hp: int(state.stats?.hp),
      maxHp: Math.max(1, int(state.stats?.maxHp) || 100),
      kills: int(state.stats?.kills),
    },
  }
}

function sanitizeEvent(event) {
  if (!event || typeof event !== 'object') return null
  const type = String(event.type ?? '').trim().slice(0, 80)
  if (!type) return null
  const clean = cloneJsonValue(event)
  if (!clean || typeof clean !== 'object') return null
  return { ...clean, type }
}

function cloneJsonValue(value, depth = 0) {
  if (depth > 6) return null
  if (value == null || typeof value === 'string' || typeof value === 'boolean') return value
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0
  if (Array.isArray(value)) return value.slice(0, 32).map((entry) => cloneJsonValue(entry, depth + 1))
  if (typeof value !== 'object') return null
  const result = {}
  for (const [key, entry] of Object.entries(value).slice(0, 48)) {
    if (typeof entry === 'function' || typeof entry === 'symbol' || entry === undefined) continue
    result[String(key).slice(0, 80)] = cloneJsonValue(entry, depth + 1)
  }
  return result
}

function compareReplayPlayers(left, right) {
  const leftSlot = Number.isInteger(left?.slot) ? left.slot : Number.MAX_SAFE_INTEGER
  const rightSlot = Number.isInteger(right?.slot) ? right.slot : Number.MAX_SAFE_INTEGER
  if (leftSlot !== rightSlot) return leftSlot - rightSlot
  return String(left?.id ?? '').localeCompare(String(right?.id ?? ''))
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
  const result = { type, rarity: String(item.rarity ?? 'common').slice(0, 20) }
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

function compactEffects(effects) {
  if (!effects || typeof effects !== 'object') return {}
  const result = {}
  for (const [key, value] of Object.entries(effects).slice(0, 32)) {
    if (typeof value === 'number' && Number.isFinite(value)) result[String(key).slice(0, 60)] = value
    else if (typeof value === 'boolean' || typeof value === 'string') result[String(key).slice(0, 60)] = value
  }
  return result
}

function compactPortal(portal) {
  if (!portal || typeof portal !== 'object') return null
  return {
    open: portal.open !== false,
    x: roundWorld(portal.x),
    y: roundWorld(portal.y),
  }
}

function replayDropId(drop, index) {
  if (drop?.id != null && String(drop.id)) return String(drop.id).slice(0, 100)
  const item = drop?.item ?? {}
  return [
    'drop', Math.round(Number(drop?.x) || 0), Math.round(Number(drop?.y) || 0),
    String(item.type ?? ''), String(item.archetype ?? ''), int(item.damage ?? item.heal), index,
  ].join(':').slice(0, 100)
}

function roomTemplate(geometry = {}) {
  const value = geometry.templateId ?? geometry.template ?? geometry.name ?? geometry.layout ?? null
  return value == null ? null : String(value).slice(0, 80)
}

function normalizeRunSeed(value) {
  const seed = String(value ?? '').trim().toUpperCase()
  return seed ? seed.slice(0, 100) : null
}

function normalizeFacing(value) {
  const facing = String(value ?? 'down')
  return PLAYER_DIRECTIONS.has(facing) ? facing : 'down'
}

function normalizeOptionalFacing(value) {
  if (value == null || value === '') return null
  const facing = String(value)
  return PLAYER_DIRECTIONS.has(facing) ? facing : null
}

function compactScalar(value) {
  if (value == null) return null
  if (typeof value === 'number') return Number.isFinite(value) ? value : null
  if (typeof value === 'boolean') return value
  return String(value).slice(0, 40)
}

function int(value) { return Math.round(Number(value) || 0) }
function roundWorld(value) { return Math.round((Number(value) || 0) * 100) / 100 }