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


const SCENE_PLAYER_ALIASES = Object.freeze({
  playerState: 'state',
  player: 'actor',
  playerBar: 'bar',
  playerFacing: 'facing',
  playerMoving: 'moving',
  playerAttacking: 'attacking',
  lastAttackAt: 'lastAttackAt',
  skillReadyAt: 'skillReadyAt',
  lastContactAt: 'lastContactAt',
  dead: 'dead',
})

export function attachLocalPlayerEntity(scene, options = {}) {
  const player = createPlayerEntity({ id: 'local', ...options })
  scene.localPlayer = player
  for (const [sceneKey, playerKey] of Object.entries(SCENE_PLAYER_ALIASES)) {
    Object.defineProperty(scene, sceneKey, {
      configurable: true,
      enumerable: true,
      get() { return this.localPlayer[playerKey] },
      set(value) { this.localPlayer[playerKey] = value },
    })
  }
  return player
}
