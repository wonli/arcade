function clone(value) {
  return structuredClone(value ?? {})
}

function stableValueSignature(value) {
  if (value === null) return 'null'
  if (value === undefined) return 'undefined'
  if (typeof value === 'number') return Number.isNaN(value) ? 'number:NaN' : `number:${value}`
  if (typeof value === 'boolean') return `boolean:${value}`
  if (typeof value === 'string') return `string:${value.length}:${value}`
  if (Array.isArray(value)) return `array:${value.length}:${value.map(stableValueSignature).join('|')}`
  if (typeof value === 'object') {
    const keys = Object.keys(value).sort()
    return `object:${keys.length}:${keys.map((key) => `${stableValueSignature(key)}=${stableValueSignature(value[key])}`).join('|')}`
  }
  return `${typeof value}:${String(value)}`
}

export function playerStateSignature(state) {
  return stableValueSignature(state)
}

function numericCooldowns(cooldowns = {}) {
  const result = {}
  for (const [skillId, readyAt] of Object.entries(cooldowns ?? {})) {
    const value = Number(readyAt)
    if (Number.isFinite(value)) result[skillId] = Math.max(0, value)
  }
  return result
}

export function serializePlayerSnapshot(player) {
  if (!player || typeof player !== 'object') throw new TypeError('Player is required')
  if (player.id == null || String(player.id).trim() === '') throw new TypeError('Player id is required')

  const snapshot = {
    id: String(player.id),
    state: clone(player.state),
    facing: player.facing ?? 'down',
    moving: Boolean(player.moving),
    attacking: Boolean(player.attacking),
    dead: Boolean(player.dead),
    lastAttackAt: Number(player.lastAttackAt) || 0,
    lastContactAt: Number(player.lastContactAt) || 0,
    skillCooldowns: numericCooldowns(player.runtime?.skills?.cooldowns),
  }
  if (Number.isInteger(player.slot)) snapshot.slot = player.slot
  return snapshot
}

export function serializePlayerPresence(player) {
  if (!player || typeof player !== 'object') throw new TypeError('Player is required')
  if (player.id == null || String(player.id).trim() === '') throw new TypeError('Player id is required')

  const state = player.state ?? {}
  const snapshot = {
    id: String(player.id),
    state: { x: state.x, y: state.y },
    facing: player.facing ?? 'down',
    moving: Boolean(player.moving),
    attacking: Boolean(player.attacking),
    dead: Boolean(player.dead),
    lastAttackAt: Number(player.lastAttackAt) || 0,
    lastContactAt: Number(player.lastContactAt) || 0,
    skillCooldowns: numericCooldowns(player.runtime?.skills?.cooldowns),
  }
  if (Number.isInteger(player.slot)) snapshot.slot = player.slot
  return snapshot
}

export function serializePlayerState(player) {
  const state = clone(player?.state)
  delete state.x
  delete state.y
  return state
}

export function applyPlayerSnapshot(player, snapshot) {
  if (!player || typeof player !== 'object') throw new TypeError('Player is required')
  if (!snapshot || typeof snapshot !== 'object') throw new TypeError('Player snapshot is required')

  const snapshotId = String(snapshot.id ?? '')
  if (!snapshotId || snapshotId !== String(player.id)) {
    throw new Error(`Player snapshot id ${snapshotId || '<missing>'} does not match ${player.id}`)
  }

  player.slot = Number.isInteger(snapshot.slot) ? snapshot.slot : player.slot ?? null
  player.state = clone(snapshot.state)
  player.facing = snapshot.facing ?? player.facing ?? 'down'
  player.moving = Boolean(snapshot.moving)
  player.attacking = Boolean(snapshot.attacking)
  player.dead = Boolean(snapshot.dead)
  player.lastAttackAt = Number(snapshot.lastAttackAt) || 0
  player.lastContactAt = Number(snapshot.lastContactAt) || 0

  player.runtime ??= {}
  player.runtime.skills ??= {}
  player.runtime.skills.cooldowns = numericCooldowns(snapshot.skillCooldowns)
  return player
}
