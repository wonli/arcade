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
    if (type === 'run.complete') return presentRunComplete(event)
    if (type === 'drop.spawn') return true
    return false
  }

  function emit(event) {
    if (!event || typeof event !== 'object' || !event.type) return false
    present(event)
    try { onEvent(structuredClone(event)) } catch { onEvent(event) }
    return true
  }

  function presentPlayerAttack(event) {
    const player = playerById(scene, event.playerId)
    if (!player) return false
    if (event.facing) player.facing = event.facing
    scene.syncPlayerAnimation?.('attack', player)
    const from = {
      x: Number(event.x ?? player.state?.x) || 0,
      y: Number(event.y ?? player.state?.y) || 0,
    }
    const target = {
      x: Number(event.targetX ?? from.x + 1) || 0,
      y: Number(event.targetY ?? from.y) || 0,
    }
    const dx = target.x - from.x
    const dy = target.y - from.y
    const angle = Math.atan2(dy, dx)
    if (scene.add?.arc) {
      const slash = scene.add.arc(
        from.x + Math.cos(angle) * 34,
        from.y + Math.sin(angle) * 34,
        34, -55, 55, false,
        event.critical ? 0xffdd6e : 0xeafbc9, 0.85,
      ).setAngle?.((angle * 180) / Math.PI)?.setDepth?.(30)
      if (slash) scene.tweens?.add?.({ targets: slash, alpha: 0, scale: 1.35, duration: 140, onComplete: () => slash.destroy?.() })
    }
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
    enemy.visual?.setTintFill?.(0xffffff)
    scene.time?.delayedCall?.(70, () => enemy.visual?.clearTint?.())
    return true
  }

  function presentEnemyPhase(event) {
    const enemy = enemyById(scene, event.enemyId ?? event.entityId)
    if (enemy?.visual && event.color != null) enemy.visual.setTint?.(event.color)
    scene.showBanner?.(event.label ?? 'BOSS PHASE II', event.cssColor ?? '#ff705c', 28)
    scene.cameras?.main?.shake?.(180, 0.008)
    return true
  }

  function presentHit(event) {
    const target = playerById(scene, event.targetId)
    if (target) scene.flashPlayer?.(target)
    const location = point(event)
    if (Number(event.damage) > 0) scene.damageText?.(location.x, location.y - 16, Number(event.damage), Boolean(event.critical))
    if (event.critical) scene.cameras?.main?.shake?.(70, 0.004)
    return true
  }

  function presentDeath(event) {
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
    scene.showBanner?.(event.label ?? `FLOOR ${event.floor ?? ''}`.trim(), event.color ?? '#f4f0e8', 42)
    return true
  }

  function presentFloorClear(event) {
    scene.showBanner?.(event.label ?? 'FLOOR CLEAR', event.color ?? '#c1ff56', 34)
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

  const api = { present, emit }
  scene.presentEvent = present
  scene.emitDungeonEvent = emit
  scene.__dungeonPresentationEvents = api
  return api
}
