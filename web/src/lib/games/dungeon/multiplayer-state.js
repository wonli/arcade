export function multiplayerRole(room, playerId) {
  const players = room?.players ?? []
  if (!players.some((player) => player.id === playerId)) return 'spectator'
  if (players.length < 2) return 'waiting'
  return room?.hostId === playerId ? 'host' : 'guest'
}

function clone(value) {
  if (value == null) return value
  return typeof structuredClone === 'function' ? structuredClone(value) : JSON.parse(JSON.stringify(value))
}

export function playerNetworkState(entity) {
  const state = entity?.state ?? {}
  return {
    id: String(entity?.id ?? ''),
    x: Number(state.x) || 0,
    y: Number(state.y) || 0,
    hp: Number(state.hp) || 0,
    maxHp: Number(state.maxHp) || 0,
    facing: entity?.facing ?? 'down',
    moving: Boolean(entity?.moving),
    attacking: Boolean(entity?.attacking),
    weapon: state.weapon ?? null,
    weaponRarity: state.weaponRarity ?? null,
    weaponDamage: Number(state.weaponDamage) || 0,
    weaponAffixes: clone(Array.isArray(state.weaponAffixes) ? state.weaponAffixes : []),
  }
}

export function applyRemotePlayerState(entity, incoming) {
  if (!entity || !incoming) return false
  if (entity.id && incoming.id && entity.id !== incoming.id) return false
  if (Number.isFinite(Number(incoming.x))) entity.targetX = Number(incoming.x)
  if (Number.isFinite(Number(incoming.y))) entity.targetY = Number(incoming.y)
  if ('hp' in incoming) entity.state.hp = Math.max(0, Number(incoming.hp) || 0)
  if ('maxHp' in incoming) entity.state.maxHp = Math.max(1, Number(incoming.maxHp) || 1)
  if ('weapon' in incoming) entity.state.weapon = incoming.weapon ?? null
  if ('weaponRarity' in incoming) entity.state.weaponRarity = incoming.weaponRarity ?? null
  if ('weaponDamage' in incoming) entity.state.weaponDamage = Number(incoming.weaponDamage) || 0
  if ('weaponAffixes' in incoming) entity.state.weaponAffixes = clone(Array.isArray(incoming.weaponAffixes) ? incoming.weaponAffixes : [])
  entity.facing = incoming.facing ?? entity.facing ?? 'down'
  entity.moving = Boolean(incoming.moving)
  entity.attacking = Boolean(incoming.attacking)
  return true
}

export function interpolateRemotePlayer(entity, alpha = 0.3) {
  if (!entity?.state) return entity
  const t = Math.max(0, Math.min(1, Number(alpha) || 0))
  const targetX = Number.isFinite(Number(entity.targetX)) ? Number(entity.targetX) : entity.state.x
  const targetY = Number.isFinite(Number(entity.targetY)) ? Number(entity.targetY) : entity.state.y
  entity.state.x += (targetX - entity.state.x) * t
  entity.state.y += (targetY - entity.state.y) * t
  return entity
}
