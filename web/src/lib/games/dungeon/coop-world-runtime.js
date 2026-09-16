import { syncLocalInventoryPresentation } from './inventory-presentation.js'
import { installTransientVfxRuntime } from './transient-vfx-runtime.js'

function isLivingPlayer(player) {
  return Boolean(player && !player.dead && Number(player.state?.hp ?? 0) > 0)
}

export function livingDungeonPlayers(scene) {
  return [...(scene?.players?.values?.() ?? [])].filter(isLivingPlayer)
}

export function nearestLivingDungeonPlayer(scene, point) {
  let nearest = null
  let nearestDistance = Infinity
  for (const player of livingDungeonPlayers(scene)) {
    const distance = Math.hypot(
      Number(player.state?.x ?? 0) - Number(point?.x ?? 0),
      Number(player.state?.y ?? 0) - Number(point?.y ?? 0),
    )
    if (distance >= nearestDistance) continue
    nearest = player
    nearestDistance = distance
  }
  return nearest
}

export function installCoopWorldSimulation(scene, { localPlayer = scene?.localPlayer } = {}) {
  if (!scene || typeof scene !== 'object') throw new TypeError('Dungeon scene is required')
  if (!localPlayer) throw new TypeError('Dungeon local player is required')
  if (scene.__dungeonCoopWorldSimulation) return scene.__dungeonCoopWorldSimulation

  const ownsTransientVfx = !scene.__dungeonTransientVfx
  const transientVfx = installTransientVfxRuntime(scene).wrapMethods([
    'damageText',
    'deathBurst',
    'pickupBurst',
    'effectLine',
    'showBanner',
  ])
  const originalUpdateEnemies = typeof scene.updateEnemies === 'function' ? scene.updateEnemies : null
  const originalUpdateEnemyProjectiles = typeof scene.updateEnemyProjectiles === 'function'
    ? scene.updateEnemyProjectiles
    : null
  let lastEnemyStepTime = null
  let lastHealthPotions = Math.max(0, Number(localPlayer.state?.healthPotions) || 0)

  const updateEnemies = function updateCoopEnemies(time, dt) {
    lastEnemyStepTime = Number(time)
    for (const enemy of scene.enemies ?? []) {
      if (!enemy || Number(enemy.hp) <= 0) continue
      const target = nearestLivingDungeonPlayer(scene, enemy)
      if (!target) continue
      if (enemy.boss) scene.updateBoss?.(enemy, time, dt, target)
      else if (enemy.archetype === 'ranged') scene.updateRangedEnemy?.(enemy, time, dt, target)
      else scene.moveEnemyTowardPlayer?.(enemy, time, dt, target)
    }
  }

  const updateEnemyProjectiles = function updateCoopEnemyProjectiles(dt) {
    if (!originalUpdateEnemyProjectiles) return
    const targets = livingDungeonPlayers(scene)
    if (!targets.length) return
    originalUpdateEnemyProjectiles.call(scene, dt, targets[0])
    for (let index = 1; index < targets.length; index++) {
      originalUpdateEnemyProjectiles.call(scene, 0, targets[index])
    }
  }

  const continueWorldWhileLocalDown = (time, delta) => {
    if (scene.runComplete || !localPlayer.dead) return
    const normalizedTime = Number(time)
    if (Number.isFinite(normalizedTime) && normalizedTime === lastEnemyStepTime) return
    const dt = Math.min(Math.max(0, Number(delta) || 0), 40) / 1000
    updateEnemies(normalizedTime, dt)
    updateEnemyProjectiles(dt)
  }

  const syncCanonicalInventory = () => {
    const next = Math.max(0, Number(localPlayer.state?.healthPotions) || 0)
    if (next === lastHealthPotions) return
    lastHealthPotions = next
    syncLocalInventoryPresentation(scene, localPlayer)
  }

  if (originalUpdateEnemies) scene.updateEnemies = updateEnemies
  if (originalUpdateEnemyProjectiles) scene.updateEnemyProjectiles = updateEnemyProjectiles
  scene.events?.on?.('update', continueWorldWhileLocalDown)
  scene.events?.on?.('update', syncCanonicalInventory)

  const api = {
    restore() {
      scene.events?.off?.('update', continueWorldWhileLocalDown)
      scene.events?.off?.('update', syncCanonicalInventory)
      if (scene.updateEnemies === updateEnemies && originalUpdateEnemies) scene.updateEnemies = originalUpdateEnemies
      if (scene.updateEnemyProjectiles === updateEnemyProjectiles && originalUpdateEnemyProjectiles) {
        scene.updateEnemyProjectiles = originalUpdateEnemyProjectiles
      }
      if (ownsTransientVfx) transientVfx.restore()
      if (scene.__dungeonCoopWorldSimulation === api) scene.__dungeonCoopWorldSimulation = null
    },
  }

  scene.__dungeonCoopWorldSimulation = api
  return api
}
