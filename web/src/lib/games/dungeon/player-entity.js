function cloneGameplayState(state) {
  return structuredClone(state ?? {})
}

function playerRegistry(scene) {
  if (!scene || typeof scene !== 'object') throw new TypeError('Scene is required')
  scene.players ??= new Map()
  if (!(scene.players instanceof Map)) throw new TypeError('scene.players must be a Map')
  return scene.players
}

function playerSkillRuntime(player) {
  if (!player || typeof player !== 'object') throw new TypeError('Player is required')
  player.runtime ??= {}
  player.runtime.skills ??= { cooldowns: {} }
  player.runtime.skills.cooldowns ??= {}
  return player.runtime.skills
}

export function getPlayerSkillReadyAt(player, skillId = 'primary') {
  return Number(player?.runtime?.skills?.cooldowns?.[skillId] ?? 0)
}

export function setPlayerSkillReadyAt(player, skillId = 'primary', readyAt = 0) {
  const runtime = playerSkillRuntime(player)
  runtime.cooldowns[skillId] = Math.max(0, Number(readyAt) || 0)
  return runtime.cooldowns[skillId]
}

export function startPlayerSkillCooldown(player, skillId = 'primary', now = 0, cooldown = 0) {
  return setPlayerSkillReadyAt(player, skillId, Number(now) + Math.max(0, Number(cooldown) || 0))
}

export class PlayerEntity {
  constructor({ id, state = {}, actor = null, bar = null, facing = 'down' } = {}) {
    if (id == null || String(id).trim() === '') throw new TypeError('Player id is required')

    this.id = String(id)
    const gameplayState = cloneGameplayState(state)
    Object.defineProperty(this, 'state', {
      enumerable: true,
      configurable: false,
      get: () => gameplayState,
      set: (nextState) => {
        const next = cloneGameplayState(nextState)
        for (const key of Object.keys(gameplayState)) {
          if (!(key in next)) delete gameplayState[key]
        }
        Object.assign(gameplayState, next)
      },
    })
    this.actor = actor
    this.bar = bar
    this.runtime = {}
    this.facing = facing
    this.moving = false
    this.attacking = false
    this.lastAttackAt = 0
    this.lastContactAt = 0
    this.dead = false
  }

  get skillReadyAt() {
    return getPlayerSkillReadyAt(this, 'primary')
  }

  set skillReadyAt(readyAt) {
    setPlayerSkillReadyAt(this, 'primary', readyAt)
  }
}

export function createPlayerEntity(options) {
  return new PlayerEntity(options)
}

export function attachPlayerEntity(scene, options = {}) {
  const player = createPlayerEntity(options)
  const players = playerRegistry(scene)
  if (players.has(player.id)) throw new Error(`Player ${player.id} is already attached`)
  players.set(player.id, player)
  return player
}

export function attachLocalPlayerEntity(scene, options = {}) {
  const player = attachPlayerEntity(scene, { id: 'local', ...options })
  scene.localPlayer = player
  return player
}
