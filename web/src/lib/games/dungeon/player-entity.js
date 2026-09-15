function cloneGameplayState(state) {
  return structuredClone(state ?? {})
}

function playerRegistry(scene) {
  if (!scene || typeof scene !== 'object') throw new TypeError('Scene is required')
  scene.players ??= new Map()
  if (!(scene.players instanceof Map)) throw new TypeError('scene.players must be a Map')
  return scene.players
}

export class PlayerEntity {
  constructor({ id, state = {}, actor = null, bar = null, facing = 'down' } = {}) {
    if (id == null || String(id).trim() === '') throw new TypeError('Player id is required')

    this.id = String(id)
    this.state = cloneGameplayState(state)
    this.actor = actor
    this.bar = bar
    this.runtime = {}
    this.facing = facing
    this.moving = false
    this.attacking = false
    this.lastAttackAt = 0
    this.skillReadyAt = 0
    this.lastContactAt = 0
    this.dead = false
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
