export function installDungeonReplayEventCapture(scene) {
  if (!scene || typeof scene !== 'object') throw new TypeError('Dungeon scene is required')
  if (scene.__dungeonReplayEventCapture) return scene.__dungeonReplayEventCapture

  const restore = []

  wrap('fireEnemyProjectile', (original, enemy, target) => {
    const before = new Set((scene.enemyProjectiles ?? []).map((entry) => entry?.id))
    const result = original(enemy, target)
    const projectile = (scene.enemyProjectiles ?? []).find((entry) => entry?.id && !before.has(entry.id))
    if (projectile) {
      scene.captureDungeonEvent?.({
        type: 'projectile.spawn',
        projectileId: String(projectile.id),
        kind: projectile.kind ?? 'enemy',
        ownerId: String(projectile.ownerId ?? enemy?.id ?? ''),
        targetId: String(target?.id ?? ''),
        x: Number(projectile.x) || 0,
        y: Number(projectile.y) || 0,
        vx: Number(projectile.vx) || 0,
        vy: Number(projectile.vy) || 0,
      })
    }
    return result
  })

  wrap('hitPlayer', (original, damage, player = scene.localPlayer) => {
    const beforeHp = Number(player?.state?.hp) || 0
    const result = original(damage, player)
    const afterHp = Number(player?.state?.hp) || 0
    if (afterHp < beforeHp) {
      scene.captureDungeonEvent?.({
        type: 'hit',
        sourceId: '',
        targetId: String(player?.id ?? ''),
        x: Number(player?.state?.x) || 0,
        y: Number(player?.state?.y) || 0,
        damage: beforeHp - afterHp,
        beforeHp,
        afterHp,
        killed: afterHp <= 0,
        targetKind: 'player',
      })
      if (afterHp <= 0) {
        scene.captureDungeonEvent?.({
          type: 'death',
          entityId: String(player?.id ?? ''),
          x: Number(player?.state?.x) || 0,
          y: Number(player?.state?.y) || 0,
          entityKind: 'player',
        })
      }
    }
    return result
  })

  wrap('bossCharge', (original, enemy, target = scene.localPlayer) => {
    scene.captureDungeonEvent?.({
      type: 'enemy.attack',
      attack: 'charge',
      enemyId: String(enemy?.id ?? ''),
      targetId: String(target?.id ?? ''),
      x: Number(enemy?.x) || 0,
      y: Number(enemy?.y) || 0,
      targetX: Number(target?.state?.x) || 0,
      targetY: Number(target?.state?.y) || 0,
      phase: Number(enemy?.phase) || 1,
    })
    return original(enemy, target)
  })

  wrap('bossShockwave', (original, enemy, target = scene.localPlayer) => {
    scene.captureDungeonEvent?.({
      type: 'enemy.attack',
      attack: 'shockwave',
      enemyId: String(enemy?.id ?? ''),
      targetId: String(target?.id ?? ''),
      x: Number(enemy?.x) || 0,
      y: Number(enemy?.y) || 0,
      phase: Number(enemy?.phase) || 1,
    })
    return original(enemy, target)
  })

  wrap('updateBoss', (original, enemy, time, dt, target = scene.localPlayer) => {
    const previousPhase = Number(enemy?.phase) || 1
    const result = original(enemy, time, dt, target)
    const nextPhase = Number(enemy?.phase) || previousPhase
    if (nextPhase !== previousPhase) {
      scene.captureDungeonEvent?.({
        type: 'enemy.phase',
        enemyId: String(enemy?.id ?? ''),
        phase: nextPhase,
        x: Number(enemy?.x) || 0,
        y: Number(enemy?.y) || 0,
        label: nextPhase === 2 ? 'BOSS PHASE II' : `BOSS PHASE ${nextPhase}`,
        color: 0xff705c,
        cssColor: '#ff705c',
      })
    }
    return result
  })

  wrap('spawnDrop', (original, x, y, item) => {
    const result = original(x, y, item)
    const drop = result && typeof result === 'object'
      ? result
      : (scene.drops ?? []).at?.(-1) ?? null
    scene.captureDungeonEvent?.({
      type: 'drop.spawn',
      entityId: String(drop?.id ?? ''),
      x: Number(drop?.x ?? x) || 0,
      y: Number(drop?.y ?? y) || 0,
      item: clone(drop?.item ?? item),
    })
    return result
  })

  wrap('pickupBurst', (original, x, y, item, healed = 0) => {
    const result = original(x, y, item, healed)
    scene.captureDungeonEvent?.({ type: 'pickup', x: Number(x) || 0, y: Number(y) || 0, item: clone(item), healed: Number(healed) || 0 })
    return result
  })

  wrap('startFloor', (original, initial = false, player = scene.localPlayer) => {
    const result = original(initial, player)
    const progress = scene.__infiniteDungeon?.getProgress?.() ?? {}
    scene.captureDungeonEvent?.({
      type: 'floor.start',
      floor: Number(progress.floor ?? scene.floor) || 1,
      chapter: Number(progress.chapter) || 1,
      chapterFloor: Number(progress.chapterFloor ?? progress.room) || 1,
      roomRole: progress.roomRole ?? 'combat',
      playerId: String(player?.id ?? ''),
      x: Number(player?.state?.x) || 0,
      y: Number(player?.state?.y) || 0,
    })
    return result
  })

  wrap('checkFloorClear', (original, player = scene.localPlayer) => {
    const wasCleared = Boolean(scene.floorCleared)
    const result = original(player)
    if (!wasCleared && scene.floorCleared) {
      const progress = scene.__infiniteDungeon?.getProgress?.() ?? {}
      scene.captureDungeonEvent?.({
        type: 'floor.clear',
        floor: Number(progress.floor ?? scene.floor) || 1,
        chapter: Number(progress.chapter) || 1,
        chapterFloor: Number(progress.chapterFloor ?? progress.room) || 1,
        roomRole: progress.roomRole ?? 'combat',
        playerId: String(player?.id ?? ''),
        x: Number(player?.state?.x) || 0,
        y: Number(player?.state?.y) || 0,
      })
    }
    return result
  })

  wrap('openPortal', (original, ...args) => {
    const before = scene.portal
    const result = original(...args)
    const portal = scene.portal ?? result
    if (!before && portal) {
      scene.captureDungeonEvent?.({
        type: 'portal.open',
        floor: Number(scene.floor) || 1,
        x: Number(portal.x) || 0,
        y: Number(portal.y) || 0,
      })
    }
    return result
  })

  wrap('advanceFloor', (original, player = scene.localPlayer) => {
    if (scene.portal) {
      scene.captureDungeonEvent?.({
        type: 'portal.enter',
        playerId: String(player?.id ?? ''),
        floor: Number(scene.floor) || 1,
        x: Number(scene.portal.x) || 0,
        y: Number(scene.portal.y) || 0,
      })
    }
    return original(player)
  })

  wrap('completeRun', (original, player = scene.localPlayer) => {
    const alreadyComplete = Boolean(scene.runComplete)
    const result = original(player)
    if (!alreadyComplete && scene.runComplete) {
      scene.captureDungeonEvent?.({
        type: 'run.complete',
        playerId: String(player?.id ?? ''),
        floor: Number(scene.floor) || 1,
        kills: Number(scene.kills) || 0,
      })
    }
    return result
  })

  wrap('gameOver', (original, player = scene.localPlayer) => {
    const wasDead = Boolean(player?.dead)
    const result = original(player)
    if (!wasDead && player?.dead) {
      scene.captureDungeonEvent?.({
        type: 'run.ended',
        playerId: String(player?.id ?? ''),
        floor: Number(scene.floor) || 1,
        kills: Number(scene.kills) || 0,
      })
    }
    return result
  })

  function wrap(name, wrapper) {
    if (typeof scene[name] !== 'function') return
    const originalMethod = scene[name]
    const original = originalMethod.bind(scene)
    const wrapped = (...args) => wrapper(original, ...args)
    scene[name] = wrapped
    restore.push(() => { if (scene[name] === wrapped) scene[name] = originalMethod })
  }

  function destroy() {
    while (restore.length) restore.pop()?.()
    if (scene.__dungeonReplayEventCapture === api) scene.__dungeonReplayEventCapture = null
  }

  const api = { destroy }
  scene.__dungeonReplayEventCapture = api
  scene.events?.once?.('shutdown', destroy)
  scene.events?.once?.('destroy', destroy)
  return api
}

function clone(value) {
  try { return structuredClone(value ?? null) } catch { return value ?? null }
}
