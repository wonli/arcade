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

  // Use emit when the semantic event owns presentation. It is the preferred path
  // for new gameplay code: present once, then publish the exact event for recording.
  function emit(event) {
    if (!event || typeof event !== 'object' || !event.type) return false
    present(event)
    return forward(onEvent, event)
  }

  // Existing live paths that already presented an effect can be instrumented with
  // capture while they migrate to emit. Replay still uses the single present entry.
  function capture(event) {
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
    if (scene.__dungeonVfx?.slash) {
      scene.__dungeonVfx.slash(attackOrigin, target, Boolean(event.critical))
      return true
    }

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
    const radius = Math.max(20, Number(event.radius) || 120)
    const ring = scene.add?.circle?.(origin.x, origin.y, 20, 0xc1ff56, 0.1)
    ring?.setStrokeStyle?.(4, 0xc1ff56, 0.9)
    if (ring) scene.tweens?.add?.({ targets: ring, radius, alpha: 0, duration: 320, onComplete: () => ring.destroy?.() })
    scene.cameras?.main?.shake?.(100, 0.006)
    return true
  }

  function presentEnemyAttack(event) {
    const enemy = enemyById(scene, event.enemyId ?? event.sourceId)
    if (!enemy) return false
    const target = playerById(scene, event.targetId) ?? scene.localPlayer
    if (event.attack === 'charge') {
      scene.__dungeonEnemyFeedback?.charge?.(enemy, target)
      return true
    }
    if (event.attack === 'shockwave') {
      scene.__dungeonEnemyFeedback?.shockwave?.(enemy, target)
      return true
    }
    enemy.visual?.setTintFill?.(0xffffff)
    scene.time?.delayedCall?.(70, () => enemy.visual?.clearTint?.())
    return true
  }

  function presentEnemyPhase(event) {
    const enemy = enemyById(scene, event.enemyId ?? event.entityId)
    if (enemy) scene.__dungeonEnemyFeedback?.phaseTwo?.(enemy)
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
      scene.__dungeonEnemyFeedback?.playerHit?.({ boss: Boolean(event.boss), damage: Number(event.damage) || 0 })
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
      if (!event.killed) scene.__dungeonEnemyFeedback?.hit?.(targetEnemy, sourcePlayer?.state ?? point(event, 'source'), event)
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
    if (enemy) scene.__dungeonEnemyFeedback?.death?.(enemy, event)
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
    const location = point(event)
    const color = event.color ?? 0x70f2ce
    const flash = scene.add?.circle?.(location.x, location.y, 11, color, 0.22)
    if (flash) scene.tweens?.add?.({ targets: flash, alpha: 0, scale: 1.6, duration: 120, onComplete: () => flash.destroy?.() })
    return true
  }

  function presentProjectileHit(event) {
    const location = point(event)
    const color = event.color ?? 0x70f2ce
    const flash = scene.add?.circle?.(location.x, location.y, 14, color, 0.28)
    if (flash) scene.tweens?.add?.({ targets: flash, alpha: 0, scale: 1.8, duration: 150, onComplete: () => flash.destroy?.() })
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

  const api = { present, emit, capture }
  scene.presentEvent = present
  scene.emitDungeonEvent = emit
  scene.captureDungeonEvent = capture
  scene.__dungeonPresentationEvents = api
  return api
}
