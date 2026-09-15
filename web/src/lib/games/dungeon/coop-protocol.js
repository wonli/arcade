import { normalizeDungeonInput } from './player-context.js'

function clone(value) {
  if (value == null) return value
  return typeof structuredClone === 'function'
    ? structuredClone(value)
    : JSON.parse(JSON.stringify(value))
}

function finite(value, fallback = 0) {
  const next = Number(value)
  return Number.isFinite(next) ? next : fallback
}

function optionalString(value) {
  return value == null ? undefined : String(value)
}

export function normalizeCoopInput(input = {}) {
  const normalized = normalizeDungeonInput(input)
  return {
    seq: normalized.seq,
    moveX: normalized.moveX,
    moveY: normalized.moveY,
    skill: normalized.skill,
    interact: normalized.interact,
  }
}

export function normalizeCoopEvent(event = {}) {
  const normalized = {
    eventSeq: Math.max(0, Math.floor(finite(event.eventSeq))),
    id: optionalString(event.id) ?? '',
    type: optionalString(event.type) ?? '',
  }

  const copyString = (key) => {
    const value = optionalString(event[key])
    if (value !== undefined) normalized[key] = value
  }
  const copyNumber = (key) => {
    if (Number.isFinite(Number(event[key]))) normalized[key] = Number(event[key])
  }
  const copyBoolean = (key) => {
    if (event[key] != null) normalized[key] = Boolean(event[key])
  }
  const copyData = (key) => {
    if (event[key] != null) normalized[key] = clone(event[key])
  }

  for (const key of ['runSeed', 'playerId', 'enemyId', 'dropId', 'chestId', 'sourceId', 'reason', 'archetype', 'facing']) copyString(key)
  for (const key of ['floor', 'x', 'y', 'unlockAt', 'spawnIndex', 'damage', 'healed']) copyNumber(key)
  for (const key of ['spawnElite', 'elite', 'boss', 'critical', 'killed']) copyBoolean(key)
  for (const key of ['item', 'patch', 'progress']) copyData(key)

  return normalized
}

export function acceptEventSequence(previousSeq = 0, event = {}) {
  const normalized = normalizeCoopEvent(event)
  return normalized.eventSeq > Math.max(0, Number(previousSeq) || 0) ? normalized : null
}

function normalizePlayerCorrection(player = {}) {
  return {
    id: String(player.id ?? ''),
    x: finite(player.x),
    y: finite(player.y),
    hp: Math.max(0, finite(player.hp)),
    maxHp: Math.max(1, finite(player.maxHp, 1)),
    facing: String(player.facing ?? 'down'),
    moving: Boolean(player.moving),
    attacking: Boolean(player.attacking),
    lastAttackAt: finite(player.lastAttackAt),
  }
}

function normalizeEnemyCorrection(enemy = {}) {
  return {
    id: String(enemy.id ?? ''),
    x: finite(enemy.x),
    y: finite(enemy.y),
    hp: Math.max(0, finite(enemy.hp)),
    maxHp: Math.max(1, finite(enemy.maxHp, 1)),
    facing: String(enemy.facing ?? ''),
  }
}

export function normalizeCoopSync(sync = {}) {
  return {
    tick: Math.max(0, Math.floor(finite(sync.tick))),
    runSeed: sync.runSeed == null ? '' : String(sync.runSeed),
    floor: Math.max(1, Math.floor(finite(sync.floor, 1))),
    players: Array.isArray(sync.players) ? sync.players.filter(Boolean).map(normalizePlayerCorrection) : [],
    enemies: Array.isArray(sync.enemies) ? sync.enemies.filter(Boolean).map(normalizeEnemyCorrection) : [],
  }
}

export function acceptSyncTick(previousTick = 0, sync = {}) {
  const normalized = normalizeCoopSync(sync)
  return normalized.tick > Math.max(0, Number(previousTick) || 0) ? normalized : null
}
