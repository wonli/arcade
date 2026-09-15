import { generateDungeonGeometry } from './map-generator.js'
import { rngFor } from './deterministic-rng.js'
import { roomAnchor } from './room-anchors.js'
import { movementWithCollision } from './spatial.js'

const PLAYER_RADIUS = 18

function withRandom(random, callback) {
  const previous = Math.random
  Math.random = random
  try { return callback() } finally { Math.random = previous }
}

export function deterministicEnemyId(floor, index, spawnElite = false) {
  return `enemy:${Math.max(1, Number(floor) || 1)}:${Math.max(0, Number(index) || 0)}:${spawnElite ? 'elite' : 'normal'}`
}

export function enemySpawnPatch(enemy) {
  return {
    hp: enemy.hp,
    maxHp: enemy.maxHp,
    speed: enemy.speed,
    contactDamage: enemy.contactDamage,
    projectileDamage: enemy.projectileDamage,
    projectileCooldown: enemy.projectileCooldown,
    projectileSpeed: enemy.projectileSpeed,
    attackRange: enemy.attackRange,
    preferredRange: enemy.preferredRange,
    scale: enemy.scale,
    tint: enemy.tint,
    barOffset: enemy.barOffset,
    phase: enemy.phase,
    boss: Boolean(enemy.boss),
    elite: Boolean(enemy.elite),
    archetype: enemy.archetype,
  }
}

export function applyEnemySpawnPatch(scene, enemy, patch = {}) {
  if (!enemy) return null
  const previousScale = Number(enemy.scale) || 1
  Object.assign(enemy, structuredClone(patch ?? {}))
  const nextScale = Number(enemy.scale) || previousScale
  if (enemy.visual && nextScale !== previousScale && previousScale > 0) {
    const ratio = nextScale / previousScale
    enemy.visual.setScale?.((enemy.visual.scaleX ?? 1) * ratio, (enemy.visual.scaleY ?? 1) * ratio)
  }
  if (enemy.tint != null) enemy.visual?.setTint?.(enemy.tint)
  scene.updateHealthBar?.(enemy.healthBar, enemy.x, enemy.y - (enemy.barOffset ?? 28), enemy.hp, enemy.maxHp)
  return enemy
}

export function placeCoopPlayers(scene, playerRuntime, { hostPlayerId, guestPlayerId } = {}) {
  const geometry = scene?.__roomGeometry
  if (!geometry || !playerRuntime) return false
  const host = playerRuntime.playerById?.(hostPlayerId)
  const guest = playerRuntime.playerById?.(guestPlayerId)
  if (!host?.state || !guest?.state) return false

  const spawn = roomAnchor(geometry, 'spawn')
  const guestSpawn = movementWithCollision(spawn, { x: 42, y: 0 }, PLAYER_RADIUS, geometry)
  host.state.x = spawn.x
  host.state.y = spawn.y
  guest.state.x = guestSpawn.x
  guest.state.y = guestSpawn.y
  playerRuntime.updatePlayerVisual?.(host)
  playerRuntime.updatePlayerVisual?.(guest)
  return true
}

export function installDeterministicCoopWorld(scene, { runSeed } = {}) {
  if (!scene || scene.__dungeonCoopWorld) return scene?.__dungeonCoopWorld ?? null
  const seed = String(runSeed ?? '')
  if (!seed) throw new Error('deterministic co-op world requires runSeed')

  const originalDrawArena = scene.drawArena?.bind(scene)
  const originalSpawnEnemy = scene.spawnEnemy?.bind(scene)

  scene.drawArena = function drawDeterministicCoopArena() {
    const geometry = generateDungeonGeometry({ runSeed: seed, floor: scene.floor })
    if (scene.__dungeonSpatial?.refreshRoom) return scene.__dungeonSpatial.refreshRoom({ geometry })
    return originalDrawArena?.()
  }

  scene.spawnEnemy = function spawnDeterministicCoopEnemy(index = 0, options = {}) {
    const spawnElite = Boolean(options?.elite)
    const random = rngFor(seed, scene.floor, 'enemy', `${index}:${spawnElite ? 'elite' : 'normal'}`)
    const enemy = withRandom(random, () => originalSpawnEnemy?.(index, options))
    if (!enemy) return enemy
    enemy.id = deterministicEnemyId(scene.floor, index, spawnElite)
    enemy.__coopSpawnIndex = Number(index) || 0
    enemy.__coopSpawnElite = spawnElite
    return enemy
  }

  const api = {
    runSeed: seed,
    placePlayers: (playerRuntime, ids) => placeCoopPlayers(scene, playerRuntime, ids),
    restore() {
      scene.drawArena = originalDrawArena
      scene.spawnEnemy = originalSpawnEnemy
      if (scene.__dungeonCoopWorld === api) scene.__dungeonCoopWorld = null
    },
  }
  scene.__dungeonCoopWorld = api
  return api
}
