import { enemyBehaviorStep, enemyIntentProfile } from './enemy-behavior.js'
import { installDungeonGameplayPass } from './gameplay-pass-runtime.js'

function distanceToPlayer(scene, enemy) {
  return Math.hypot(
    (scene.localPlayer.state?.x ?? 0) - enemy.x,
    (scene.localPlayer.state?.y ?? 0) - enemy.y,
  )
}

function cue(scene, enemy, kind) {
  if (!enemy?.visual || enemy.__intentCue === kind) return

  enemy.__intentCue = kind
  const profile = enemyIntentProfile(kind)
  const scaleX = Math.abs(enemy.visual.scaleX ?? enemy.scale ?? 1)
  const scaleY = Math.abs(enemy.visual.scaleY ?? enemy.scale ?? 1)

  scene.tweens?.add?.({
    targets: enemy.visual,
    scaleX: scaleX * profile.scaleX,
    scaleY: scaleY * profile.scaleY,
    duration: Math.max(80, Math.min(220, profile.leadMs)),
    yoyo: true,
    onComplete: () => {
      enemy.__intentCue = null
      enemy.visual?.setScale?.(scaleX, scaleY)
      enemy.visual?.clearTint?.()
    },
  })

  if (profile.flash) enemy.visual.setTintFill?.(0xbfffee)
}

export function installDungeonEnemyBehaviors(scene) {
  if (!scene || scene.__dungeonEnemyBehaviors) return scene?.__dungeonEnemyBehaviors ?? null

  installDungeonGameplayPass(scene)

  const originalMove = scene.moveEnemyTowardPlayer?.bind(scene)
  const originalRanged = scene.updateRangedEnemy?.bind(scene)
  if (!originalMove) return null

  const approach = (enemy, time, dt) => originalMove(enemy, time, dt)

  const update = (enemy, time, dt) => {
    if (!enemy || enemy.hp <= 0) return

    const dx = (scene.localPlayer.state?.x ?? 0) - enemy.x
    const dy = (scene.localPlayer.state?.y ?? 0) - enemy.y
    const distance = Math.hypot(dx, dy) || 1

    if ((enemy.archetype === 'fast' || enemy.archetype === 'brute') && enemy.nextSpecialAt == null) {
      enemy.nextSpecialAt = time + 650
    }
    if (enemy.archetype === 'skeleton' && enemy.strafeSign == null) {
      enemy.strafeSign = Math.floor(Math.abs(enemy.x + enemy.y)) % 2 ? 1 : -1
    }

    if (
      enemy.archetype === 'fast' &&
      enemy.nextSpecialAt - time <= enemyIntentProfile('fast').leadMs &&
      enemy.nextSpecialAt > time
    ) {
      cue(scene, enemy, 'fast')
    }

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
      cue(scene, enemy, 'brute')
      enemy.specialLockedUntil = time + step.durationMs
      enemy.nextSpecialAt = enemy.specialLockedUntil + step.cooldownMs

      const warning = scene.add
        ?.circle?.(enemy.x, enemy.y, 20, 0xffa34d, 0.08)
        ?.setStrokeStyle?.(3, 0xffa34d, 0.78)
        ?.setDepth?.(22)

      if (warning) {
        scene.tweens?.add?.({
          targets: warning,
          radius: step.radius,
          alpha: 0.34,
          duration: step.durationMs,
          onComplete: () => warning.destroy?.(),
        })
      }

      scene.time?.delayedCall?.(step.durationMs, () => {
        if (enemy.hp <= 0 || scene.localPlayer.dead) return
        if (distanceToPlayer(scene, enemy) <= step.radius) {
          scene.hitPlayer?.(enemy.contactDamage + 4)
        }
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

  if (originalRanged) {
    scene.updateRangedEnemy = function rangedWithIntent(enemy, time, dt) {
      const lead = enemyIntentProfile('ranged').leadMs
      if ((enemy.nextProjectileAt ?? Infinity) - time <= lead && (enemy.nextProjectileAt ?? 0) > time) {
        cue(scene, enemy, 'ranged')
      }
      return originalRanged(enemy, time, dt)
    }
  }

  const restore = () => {
    scene.moveEnemyTowardPlayer = originalMove
    if (originalRanged) scene.updateRangedEnemy = originalRanged
    scene.__dungeonGameplayPass?.restore?.()
    scene.__dungeonEnemyBehaviors = null
  }

  scene.events?.once?.('shutdown', restore)
  scene.events?.once?.('destroy', restore)

  const api = { update, restore }
  scene.__dungeonEnemyBehaviors = api
  return api
}
