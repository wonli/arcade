export const PLAYER_BASE_STATS = { damage: 10, critChance: 0.18, speed: 190, maxHp: 100 }

function cloneWeapon(item) {
  if (!item) return null
  return { ...item, affixes: (item.affixes ?? []).map((entry) => ({ ...entry })) }
}

export function createPlayerState(overrides = {}) {
  const baseStats = { ...PLAYER_BASE_STATS, ...(overrides.baseStats ?? {}) }
  return {
    x: 480,
    y: 300,
    hp: baseStats.maxHp,
    ...PLAYER_BASE_STATS,
    ...overrides,
    baseStats,
    critMultiplier: overrides.critMultiplier ?? 2,
    weapon: overrides.weapon ?? null,
    weaponRarity: overrides.weaponRarity ?? null,
    weaponDamage: overrides.weaponDamage ?? 0,
    weaponAffixes: (overrides.weaponAffixes ?? []).map((entry) => ({ ...entry })),
    equippedWeapon: cloneWeapon(overrides.equippedWeapon),
    effects: { ...(overrides.effects ?? {}) },
    hasteUntil: overrides.hasteUntil ?? 0,
  }
}

export function syncPlayerEntityVisual(scene, entity, forceAction = null) {
  if (!entity) return entity
  const state = entity.state ?? {}
  entity.visual?.setPosition?.(state.x, state.y)
  scene.updateHealthBar?.(entity.bar, state.x, state.y - 42, state.hp, state.maxHp)

  if (!entity.visual?.anims) return entity
  const action = forceAction || (entity.attacking ? 'attack' : entity.moving ? 'walk' : 'idle')
  const facing = entity.facing ?? 'down'
  const direction = facing === 'up' ? 'up' : facing === 'down' ? 'down' : 'side'
  const key = `dungeon-player-${direction}-${action}`
  entity.visual.setFlipX?.(facing === 'left')
  if (scene.anims?.exists?.(key) && entity.visual.anims.currentAnim?.key !== key) entity.visual.play?.(key, true)
  return entity
}

function attachAnimationReset(scene, entity) {
  entity.visual?.on?.('animationcomplete', (animation) => {
    if (!animation?.key?.endsWith('-attack')) return
    entity.attacking = false
    syncPlayerEntityVisual(scene, entity)
  })
}

export function createPlayerEntity(scene, {
  id,
  state = createPlayerState(),
  local = false,
  barColor = local ? 0x55e879 : 0x67a8ff,
} = {}) {
  if (!scene || !id) return null
  scene.players ??= new Map()
  const existing = scene.players.get(id)
  if (existing) return existing

  const playerState = createPlayerState(state)
  const visual = scene.makeActor?.(playerState.x, playerState.y, 'player')?.setDepth?.(local ? 20 : 21) ?? null
  const bar = scene.createHealthBar?.(playerState.x, playerState.y - 42, 54, 6, barColor) ?? null
  const entity = {
    id,
    state: playerState,
    visual,
    bar,
    local,
    facing: state.facing ?? 'down',
    moving: Boolean(state.moving),
    attacking: Boolean(state.attacking),
    targetX: playerState.x,
    targetY: playerState.y,
  }

  attachAnimationReset(scene, entity)
  scene.players.set(id, entity)
  syncPlayerEntityVisual(scene, entity)
  return entity
}

export function bindLocalPlayerAliases(scene, entity) {
  if (!scene || !entity) return entity
  scene.localPlayerId = entity.id
  scene.localPlayerEntity = entity
  const aliases = {
    playerState: 'state',
    player: 'visual',
    playerBar: 'bar',
    playerFacing: 'facing',
    playerMoving: 'moving',
    playerAttacking: 'attacking',
  }
  for (const [sceneKey, entityKey] of Object.entries(aliases)) {
    Object.defineProperty(scene, sceneKey, {
      configurable: true,
      enumerable: true,
      get() { return entity[entityKey] },
      set(value) { entity[entityKey] = value },
    })
  }
  return entity
}

export function adoptLocalPlayerEntity(scene, id) {
  if (!scene || !id) return null
  scene.players ??= new Map()
  const byId = scene.players.get(id)
  if (byId) return bindLocalPlayerAliases(scene, byId)

  const current = scene.localPlayerEntity
  if (current) {
    if (current.id !== id) scene.players.delete(current.id)
    current.id = id
    current.local = true
    scene.players.set(id, current)
    return bindLocalPlayerAliases(scene, current)
  }

  const state = scene.playerState
  const entity = {
    id,
    state,
    visual: scene.player,
    bar: scene.playerBar,
    local: true,
    facing: scene.playerFacing ?? 'down',
    moving: Boolean(scene.playerMoving),
    attacking: Boolean(scene.playerAttacking),
    targetX: state?.x ?? 480,
    targetY: state?.y ?? 300,
  }
  scene.players.set(id, entity)
  return bindLocalPlayerAliases(scene, entity)
}

export function destroyPlayerEntity(scene, id) {
  const entity = scene?.players?.get?.(id)
  if (!entity) return false
  entity.visual?.destroy?.()
  scene.destroyHealthBar?.(entity.bar)
  scene.players.delete(id)
  return true
}
