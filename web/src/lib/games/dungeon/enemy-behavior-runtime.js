import { enemyBehaviorProfile, enemyBehaviorStep } from './enemy-behavior.js'

function distanceToPlayer(scene, enemy) {
  return Math.hypot((scene.playerState?.x ?? 0) - enemy.x, (scene.playerState?.y ?? 0) - enemy.y)
}

export function installDungeonEnemyBehaviors(scene) {
  if (!scene || scene.__dungeonEnemyBehaviors) return scene?.__dungeonEnemyBehaviors ?? null
  const originalMove = scene.moveEnemyTowardPlayer?.bind(scene)
  if (!originalMove) return null

  const approach = (enemy, time, dt) => originalMove(enemy, time, dt)
  const update = (enemy, time, dt) => {
    if (!enemy || enemy.hp <= 0) return
    const profile = enemyBehaviorProfile(enemy.archetype)
    const dx = (scene.playerState?.x ?? 0) - enemy.x
    const dy = (scene.playerState?.y ?? 0) - enemy.y
    const distance = Math.hypot(dx, dy) || 1

    if (enemy.archetype === 'fast' && time < (enemy.dashUntil ?? 0)) {
      enemy.x += (enemy.dashVx ?? 0) * dt
      enemy.y += (enemy.dashVy ?? 0) * dt
      scene.syncEnemyVisual?.(enemy, time, dx, distance)
      return
    }
    if (enemy.archetype === 'brute' && time < (enemy.specialLockedUntil ?? 0)) {
      scene.syncEnemyVisual?.(enemy, time, dx, distance)
      return
    }

    const step = enemyBehaviorStep(enemy, { distance, time })
    if (step.action === 'dash') {
      enemy.dashVx = (dx / distance) * enemy.speed * step.speedMultiplier
      enemy.dashVy = (dy / distance) * enemy.speed * step.speedMultiplier
      enemy.dashUntil = time + step.durationMs
      enemy.nextSpecialAt = enemy.dashUntil + step.cooldownMs
      enemy.x += enemy.dashVx * dt
      enemy.y += enemy.dashVy * dt
      scene.syncEnemyVisual?.(enemy, time, dx, distance)
      return
    }
    if (step.action === 'slam-windup') {
      enemy.specialLockedUntil = time + step.durationMs
      enemy.nextSpecialAt = enemy.specialLockedUntil + step.cooldownMs
      const warning = scene.add?.circle?.(enemy.x, enemy.y, 20, 0xffa34d, 0.08)?.setStrokeStyle?.(3, 0xffa34d, 0.78)?.setDepth?.(22)
      if (warning) scene.tweens?.add?.({ targets: warning, radius: step.radius, alpha: 0.34, duration: step.durationMs, onComplete: () => warning.destroy?.() })
      scene.time?.delayedCall?.(step.durationMs, () => {
        if (enemy.hp <= 0 || scene.dead) return
        if (distanceToPlayer(scene, enemy) <= step.radius) scene.hitPlayer?.(enemy.contactDamage + 4)
      })
      scene.syncEnemyVisual?.(enemy, time, dx, distance)
      return
    }
    if (step.action === 'sidestep') {
      const sign = step.sign || 1
      enemy.x += (-dy / distance) * enemy.speed * step.speedMultiplier * sign * dt
      enemy.y += (dx / distance) * enemy.speed * step.speedMultiplier * sign * dt
      scene.syncEnemyVisual?.(enemy, time, dx, distance)
      return
    }
    approach(enemy, time, dt)
  }

  scene.moveEnemyTowardPlayer = function tacticalEnemyMovement(enemy, time, dt) {
    if (enemy?.boss || enemy?.archetype === 'ranged') return originalMove(enemy, time, dt)
    return update(enemy, time, dt)
  }
  const restore = () => { scene.moveEnemyTowardPlayer = originalMove; scene.__dungeonEnemyBehaviors = null }
  scene.events?.once?.('shutdown', restore); scene.events?.once?.('destroy', restore)
  const api = { update, restore }; scene.__dungeonEnemyBehaviors = api; return api
}
