import { enemyBehaviorStep, enemyIntentProfile } from './enemy-behavior.js'
import { installDungeonGameplayPass } from './gameplay-pass-runtime.js'
import { nearestLivingPlayer } from './player-targeting.js'

function distanceToPlayer(player, enemy) {
  return Math.hypot(
    (player.state?.x ?? 0) - enemy.x,
    (player.state?.y ?? 0) - enemy.y,
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

function playerById(scene, id, fallback = null) {
  const normalized = String(id ?? '')
  if (normalized && scene.players instanceof Map) {
    const player = scene.players.get(normalized)
    if (player) return player
  }
  if (fallback && (!normalized || String(fallback.id ?? '') === normalized)) return fallback
  if (scene.localPlayer && (!normalized || String(scene.localPlayer.id ?? '') === normalized)) return scene.localPlayer
  return null
}

export function installDungeonEnemyBehaviors(scene, { player = scene?.localPlayer } = {}) {
  if (!scene || !player || scene.__dungeonEnemyBehaviors) return scene?.__dungeonEnemyBehaviors ?? null

  installDungeonGameplayPass(scene, { player })

  const originalMove = scene.moveEnemyTowardPlayer?.bind(scene)
  const originalRanged = scene.updateRangedEnemy?.bind(scene)
  if (!originalMove) return null

  const resolveTarget = (enemy, requested = null) => {
    if (requested && requested !== player) return requested
    if (scene.players instanceof Map && scene.players.size > 1) {
      return nearestLivingPlayer(scene, enemy) ?? requested ?? player
    }
    return requested ?? player
  }

  const resolvePendingSpecial = (enemy, time, fallbackTarget = null) => {
    const pending = enemy?.pendingSpecial
    if (!pending || pending.type !== 'brute_slam' || time < (pending.resolveAt ?? Infinity)) return false

    enemy.pendingSpecial = null
    if (enemy.hp <= 0) return true

    const target = playerById(scene, pending.targetId, fallbackTarget)
    if (!target || target.dead) return true

    const center = {
      x: Number.isFinite(Number(pending.x)) ? Number(pending.x) : enemy.x,
      y: Number.isFinite(Number(pending.y)) ? Number(pending.y) : enemy.y,
    }
    const radius = Math.max(0, Number(pending.radius) || 0)
    if (distanceToPlayer(target, center) <= radius) {
      scene.hitPlayer?.(Math.max(0, Number(pending.damage) || 0), target)
    }
    return true
  }

  const approach = (enemy, time, dt, target = null) => {
    const resolved = resolveTarget(enemy, target)
    if (!resolved) return
    return originalMove(enemy, time, dt, resolved)
  }

  const update = (enemy, time, dt, target = null) => {
    if (!enemy) return
    if (enemy.hp <= 0) {
      enemy.pendingSpecial = null
      return
    }

    const resolved = resolveTarget(enemy, target)
    if (!resolved) return

    resolvePendingSpecial(enemy, time, resolved)

    const dx = (resolved.state?.x ?? 0) - enemy.x
    const dy = (resolved.state?.y ?? 0) - enemy.y
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
      scene.syncEnemyVisual?.(enemy, time, dx, distance, resolved)
      return
    }

    if (enemy.archetype === 'brute' && time < (enemy.specialLockedUntil ?? 0)) {
      scene.syncEnemyVisual?.(enemy, time, dx, distance, resolved)
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
      scene.syncEnemyVisual?.(enemy, time, dx, distance, resolved)
      return
    }

    if (step.action === 'slam-windup') {
      cue(scene, enemy, 'brute')
      enemy.specialLockedUntil = time + step.durationMs
      enemy.nextSpecialAt = enemy.specialLockedUntil + step.cooldownMs
      enemy.pendingSpecial = {
        type: 'brute_slam',
        resolveAt: enemy.specialLockedUntil,
        targetId: String(resolved.id ?? ''),
        x: enemy.x,
        y: enemy.y,
        radius: step.radius,
        damage: enemy.contactDamage + 4,
      }

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

      scene.syncEnemyVisual?.(enemy, time, dx, distance, resolved)
      return
    }

    if (step.action === 'sidestep') {
      const sign = step.sign || 1
      enemy.x += (-dy / distance) * enemy.speed * step.speedMultiplier * sign * dt
      enemy.y += (dx / distance) * enemy.speed * step.speedMultiplier * sign * dt
      scene.syncEnemyVisual?.(enemy, time, dx, distance, resolved)
      return
    }

    approach(enemy, time, dt, resolved)
  }

  scene.moveEnemyTowardPlayer = function tacticalEnemyMovement(enemy, time, dt, target = null) {
    const resolved = resolveTarget(enemy, target)
    if (!resolved) return
    if (enemy?.boss || enemy?.archetype === 'ranged') return originalMove(enemy, time, dt, resolved)
    return update(enemy, time, dt, resolved)
  }

  if (originalRanged) {
    scene.updateRangedEnemy = function rangedWithIntent(enemy, time, dt, target = null) {
      const resolved = resolveTarget(enemy, target)
      if (!resolved) return
      const lead = enemyIntentProfile('ranged').leadMs
      if ((enemy.nextProjectileAt ?? Infinity) - time <= lead && (enemy.nextProjectileAt ?? 0) > time) {
        cue(scene, enemy, 'ranged')
      }
      return originalRanged(enemy, time, dt, resolved)
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
