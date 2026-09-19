import { presentDungeonPlayerSkill } from './player-skill-presentation.js'

function playerById(scene, id) {
  const normalized = String(id ?? '')
  if (!normalized) return scene?.localPlayer ?? null
  if (String(scene?.localPlayer?.id ?? '') === normalized) return scene.localPlayer
  return scene?.players instanceof Map ? scene.players.get(normalized) ?? null : null
}

function enemyById(scene, id) {
  const normalized = String(id ?? '')
  return (scene?.enemies ?? []).find((enemy) => String(enemy?.id ?? '') === normalized) ?? null
}

function point(event, prefix = '') {
  const x = Number(event?.[`${prefix}x`] ?? event?.x)
  const y = Number(event?.[`${prefix}y`] ?? event?.y)
  return { x: Number.isFinite(x) ? x : 0, y: Number.isFinite(y) ? y : 0 }
}

function forward(onEvent, event) {
  try { onEvent(structuredClone(event)) } catch { onEvent(event) }
  return true
}

export function installDungeonPresentationEvents(scene, { onEvent = () => {} } = {}) {
  if (!scene || typeof scene !== 'object') throw new TypeError('Dungeon scene is required')
  if (scene.__dungeonPresentationEvents) return scene.__dungeonPresentationEvents

  function present(event = {}) {
    const type = String(event.type ?? '')
    if (!type) return false

    if (type === 'player.attack') return presentPlayerAttack(event)
    if (type === 'player.skill') return presentPlayerSkill(event)
    if (type === 'enemy.attack') return presentEnemyAttack(event)
    if (type === 'enemy.phase') return presentEnemyPhase(event)
    if (type === 'hit') return presentHit(event)
    if (type === 'death') return presentDeath(event)
    if (type === 'pickup') return presentPickup(event)
    if (type === 'projectile.spawn') return presentProjectileSpawn(event)
    if (type === 'projectile.hit') return presentProjectileHit(event)
    if (type === 'floor.start') return presentFloorStart(event)
    if (type === 'floor.clear') return presentFloorClear(event)
    if (type === 'portal.enter') return presentPortalEnter(event)
    if (type === 'portal.open' || type === 'drop.spawn') return true
    if (type === 'run.complete') return presentRunComplete(event)
    if (type === 'run.ended') return presentRunEnded(event)
    return false
  }

  function emit(event) {
    if (!event || typeof event !== 'object' || !event.type) return false
    present(event)
    const capture = scene.captureDungeonEvent
    if (typeof capture === 'function' && capture !== captureDefault) return capture(event)
    return forward(onEvent, event)
  }

  function captureDefault(event) {
    if (!event || typeof event !== 'object' || !event.type) return false
    return forward(onEvent, event)
  }

  function presentPlayerAttack(event) {
    const player = playerById(scene, event.playerId)
    if (!player) return false
    if (event.facing) player.facing = event.facing
    player.attacking = true
    scene.syncPlayerAnimation?.('attack', player)

    const from = {
      x: Number(event.x ?? player.state?.x) || 0,
      y: Number(event.y ?? player.state?.y) || 0,
    }
    const target = {
      x: Number(event.targetX ?? from.x + 1) || 0,
      y: Number(event.targetY ?? from.y) || 0,
    }
    const weaponVisuals = player.runtime?.weaponVisuals
      ?? (player === scene.localPlayer ? scene.__dungeonWeaponVisuals : null)
    const attackOrigin = weaponVisuals?.swing?.() ?? from
    scene.__dungeonVfx?.slash?.(attackOrigin, target, Boolean(event.critical))

    const dx = target.x - from.x
    const dy = target.y - from.y
    const angle = Math.atan2(dy, dx)
    const slash = scene.add?.arc?.(
      from.x + Math.cos(angle) * 34,
      from.y + Math.sin(angle) * 34,
      34, -55, 55, false,
      event.critical ? 0xffdd6e : 0xeafbc9, 0.85,
    )
    slash?.setAngle?.((angle * 180) / Math.PI)?.setDepth?.(30)
    if (slash) scene.tweens?.add?.({ targets: slash, alpha: 0, scale: 1.35, duration: 140, onComplete: () => slash.destroy?.() })
    return true
  }

  function presentPlayerSkill(event) {
    const player = playerById(scene, event.playerId)
    const origin = point(event)
    if (!Number.isFinite(Number(event.x)) && player?.state) {
      origin.x = Number(player.state.x) || 0
      origin.y = Number(player.state.y) || 0
    }
    return presentDungeonPlayerSkill(scene, {
      x: origin.x,
      y: origin.y,
      radius: Math.max(20, Number(event.radius) || 120),
    })
  }

  function feedback() {
    return scene.__dungeonEnemyFeedbackPresentation ?? scene.__dungeonEnemyFeedback ?? null
  }

  function presentEnemyAttack(event) {
    const enemy = enemyById(scene, event.enemyId ?? event.sourceId)
    if (!enemy) return false
    const target = playerById(scene, event.targetId) ?? scene.localPlayer
    if (event.attack === 'charge') return feedback()?.charge?.(enemy, target) ?? false
    if (event.attack === 'shockwave') return feedback()?.shockwave?.(enemy, target) ?? false
    enemy.visual?.setTintFill?.(0xffffff)
    scene.time?.delayedCall?.(70, () => enemy.visual?.clearTint?.())
    return true
  }

  function presentEnemyPhase(event) {
    const enemy = enemyById(scene, event.enemyId ?? event.entityId)
    if (enemy) feedback()?.phaseTwo?.(enemy)
    if (enemy?.visual && event.color != null) enemy.visual.setTint?.(event.color)
    scene.showBanner?.(event.label ?? 'BOSS PHASE II', event.cssColor ?? '#ff705c', 28)
    scene.cameras?.main?.shake?.(180, 0.008)
    return true
  }

  function presentHit(event) {
    const targetPlayer = playerById(scene, event.targetId)
    const targetEnemy = enemyById(scene, event.targetId)
    const sourcePlayer = playerById(scene, event.sourceId)
    const location = point(event)

    if (targetPlayer) {
      scene.flashPlayer?.(targetPlayer)
      feedback()?.playerHit?.({ boss: Boolean(event.boss), damage: Number(event.damage) || 0 })
    }
    if (targetEnemy) {
      scene.__dungeonVfx?.impact?.(location.x, location.y, {
        explosion: event.source === 'corpse_burst',
        seed: `${event.targetId ?? ''}:${event.beforeHp ?? ''}:${event.damage ?? ''}`,
      })
      if (event.critical || (event.elite && event.killed)) {
        scene.__dungeonVfx?.critical?.(location.x, location.y, {
          seed: `${event.targetId ?? ''}:${event.beforeHp ?? ''}`,
        })
      }
      if (event.source === 'corpse_burst') {
        scene.__dungeonVfx?.smoke?.(location.x, location.y, { seed: `${event.targetId ?? ''}:corpse` })
      }
      if (!event.killed) feedback()?.hit?.(targetEnemy, sourcePlayer?.state ?? point(event, 'source'), event)
    }

    if (Number(event.damage) > 0) scene.damageText?.(location.x, location.y - 16, Number(event.damage), Boolean(event.critical))
    if (event.direct || event.critical || event.killed) {
      scene.__dungeonAttackRuntime?.playImpactSound?.({
        damage: Number(event.damage) || 0,
        critical: Boolean(event.critical),
        killed: Boolean(event.killed),
        elite: Boolean(event.elite || event.boss),
      })
    }
    if (event.critical) scene.cameras?.main?.shake?.(70, 0.004)
    return true
  }

  function presentDeath(event) {
    const enemy = enemyById(scene, event.entityId ?? event.targetId)
    if (enemy) feedback()?.death?.(enemy, event)
    const location = point(event)
    scene.deathBurst?.(location.x, location.y, event.color)
    return true
  }

  function presentPickup(event) {
    const location = point(event)
    scene.pickupBurst?.(location.x, location.y, event.item ?? {}, Number(event.healed) || 0)
    return true
  }

  function presentProjectileSpawn(event) {
    const id = String(event.projectileId ?? event.id ?? '')
    if (!id) return false
    return Boolean(scene.__dungeonProjectilePresentation?.ensure?.({
      id,
      kind: event.kind ?? 'enemy',
      ownerId: String(event.ownerId ?? ''),
      x: Number(event.x) || 0,
      y: Number(event.y) || 0,
      vx: Number(event.vx) || 0,
      vy: Number(event.vy) || 0,
      color: event.color,
    }))
  }

  function presentProjectileHit(event) {
    const id = String(event.projectileId ?? event.id ?? '')
    if (!id) return true
    scene.__dungeonProjectilePresentation?.remove?.(id)
    return true
  }

  function presentFloorStart(event) {
    scene.showBanner?.(event.label ?? `FLOOR ${event.floor ?? ''}`.trim(), event.color ?? '#f4f0e8', Number(event.size) || 42)
    return true
  }

  function presentFloorClear(event) {
    scene.showBanner?.(event.label ?? 'FLOOR CLEAR', event.color ?? '#c1ff56', Number(event.size) || 34)
    return true
  }

  function presentPortalEnter() {
    scene.cameras?.main?.flash?.(140, 112, 255, 159)
    return true
  }

  function presentRunComplete(event) {
    scene.showBanner?.(event.label ?? 'DUNGEON CLEARED', event.color ?? '#c1ff56', 42)
    return true
  }

  function presentRunEnded(event) {
    scene.showBanner?.(event.label ?? 'RUN ENDED', event.color ?? '#f4f0e8', 42)
    return true
  }

  const api = { present, emit, capture: captureDefault }
  scene.presentEvent = present
  scene.emitDungeonEvent = emit
  scene.captureDungeonEvent = captureDefault
  scene.__dungeonPresentationEvents = api
  return api
}
