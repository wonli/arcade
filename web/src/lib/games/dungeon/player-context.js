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

export function normalizeDungeonInput(input = {}) {
  let moveX = finite(input.moveX ?? input.x)
  let moveY = finite(input.moveY ?? input.y)
  const length = Math.hypot(moveX, moveY)
  if (length > 1) {
    moveX /= length
    moveY /= length
  }
  return {
    seq: Math.max(0, Math.floor(finite(input.seq))),
    moveX,
    moveY,
    skill: Boolean(input.skill),
    interact: Boolean(input.interact),
  }
}

export function mergeDungeonInput(...inputs) {
  const normalized = inputs.filter(Boolean).map(normalizeDungeonInput)
  if (!normalized.length) return normalizeDungeonInput()
  return normalizeDungeonInput({
    seq: Math.max(...normalized.map((input) => input.seq)),
    moveX: normalized.reduce((sum, input) => sum + input.moveX, 0),
    moveY: normalized.reduce((sum, input) => sum + input.moveY, 0),
    skill: normalized.some((input) => input.skill),
    interact: normalized.some((input) => input.interact),
  })
}

export function createPlayerContext({
  id = 'player',
  local = false,
  state = {},
  actor = null,
  bar = null,
  facing = 'down',
  moving = false,
  attacking = false,
  dead = false,
  lastAttackAt = 0,
  skillReadyAt = 0,
  lastContactAt = 0,
  input = {},
} = {}) {
  return {
    id: String(id || 'player'),
    local: Boolean(local),
    state,
    actor,
    bar,
    facing,
    moving: Boolean(moving),
    attacking: Boolean(attacking),
    dead: Boolean(dead),
    lastAttackAt: finite(lastAttackAt),
    skillReadyAt: finite(skillReadyAt),
    lastContactAt: finite(lastContactAt),
    input: normalizeDungeonInput(input),
  }
}

export function snapshotPlayerContext(player) {
  if (!player) return null
  return {
    id: player.id,
    state: clone(player.state ?? {}),
    facing: player.facing ?? 'down',
    moving: Boolean(player.moving),
    attacking: Boolean(player.attacking),
    dead: Boolean(player.dead || (player.state?.hp ?? 1) <= 0),
    lastAttackAt: finite(player.lastAttackAt),
    skillReadyAt: finite(player.skillReadyAt),
    lastContactAt: finite(player.lastContactAt),
  }
}

export function applyPlayerContextSnapshot(player, snapshot, { preservePosition = false } = {}) {
  if (!player || !snapshot) return player
  const previousX = player.state?.x
  const previousY = player.state?.y
  const nextState = clone(snapshot.state ?? {})
  if (preservePosition && player.state) {
    nextState.x = previousX
    nextState.y = previousY
  }
  player.state = nextState
  player.facing = snapshot.facing ?? player.facing ?? 'down'
  player.moving = Boolean(snapshot.moving)
  player.attacking = Boolean(snapshot.attacking)
  player.dead = Boolean(snapshot.dead || (nextState.hp ?? 1) <= 0)
  player.lastAttackAt = finite(snapshot.lastAttackAt, player.lastAttackAt)
  player.skillReadyAt = finite(snapshot.skillReadyAt, player.skillReadyAt)
  player.lastContactAt = finite(snapshot.lastContactAt, player.lastContactAt)
  return player
}
