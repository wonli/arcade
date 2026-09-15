function cloneGameplayState(state) {
  return structuredClone(state ?? {})
}

export class PlayerEntity {
  constructor({ id, state = {}, actor = null, bar = null, facing = 'down' } = {}) {
    if (id == null || String(id).trim() === '') throw new TypeError('Player id is required')

    this.id = String(id)
    this.state = cloneGameplayState(state)
    this.actor = actor
    this.bar = bar
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


export function attachLocalPlayerEntity(scene, options = {}) {
  const player = createPlayerEntity({ id: 'local', ...options })
  scene.localPlayer = player
  return player
}
