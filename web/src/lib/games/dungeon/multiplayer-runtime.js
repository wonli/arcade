import { applyPickup, attackInterval, nearestTarget, skillProfile } from './combat.js'
import { applyEnemySnapshot, applyPlayerSnapshot, createDungeonSnapshot, shouldIncludeGeometry, snapshotSignature } from './multiplayer-state.js'

const INPUT_INTERVAL_MS = 50
const SNAPSHOT_INTERVAL_MS = 100
const PLAYER_RADIUS = 18

function distance(a, b) { return Math.hypot((a?.x ?? 0) - (b?.x ?? 0), (a?.y ?? 0) - (b?.y ?? 0)) }
function living(state) { return (state?.hp ?? 0) > 0 }

function makePeerState(scene) {
  const source = scene.playerState ?? {}
  return {
    ...structuredClone(source),
    x: Math.max(72, (source.x ?? 480) + 44),
    y: source.y ?? 300,
    facing: 'down', moving: false,
    lastAttackAt: 0, skillReadyAt: 0,
  }
}

function makePeerVisual(scene, state) {
  const actor = scene.makeActor?.(state.x, state.y, 'player')
  actor?.setDepth?.(21)
  actor?.setAlpha?.(0.86)
  const bar = scene.createHealthBar?.(state.x, state.y - 42, 54, 6, 0x67a8ff) ?? null
  return { actor, bar }
}

function syncActor(scene, runtime, state) {
  runtime.actor?.setPosition?.(state.x, state.y)
  if (runtime.bar) scene.updateHealthBar?.(runtime.bar, state.x, state.y - 42, state.hp, state.maxHp)
  if (!runtime.actor?.anims) return
  const facing = state.facing ?? 'down'
  const direction = facing === 'up' ? 'up' : facing === 'down' ? 'down' : 'side'
  const action = state.attacking ? 'attack' : state.moving ? 'walk' : 'idle'
  const key = `dungeon-player-${direction}-${action}`
  runtime.actor.setFlipX?.(facing === 'left')
  if (scene.anims?.exists?.(key) && runtime.actor.anims.currentAnim?.key !== key) runtime.actor.play?.(key, true)
}

function peerContext(scene, peer, fn) {
  const saved = {
    playerState: scene.playerState,
    player: scene.player,
    playerBar: scene.playerBar,
    playerFacing: scene.playerFacing,
    playerMoving: scene.playerMoving,
    playerAttacking: scene.playerAttacking,
    lastAttackAt: scene.lastAttackAt,
    skillReadyAt: scene.skillReadyAt,
    lastContactAt: scene.lastContactAt,
    emitStats: scene.emitStats,
  }
  scene.playerState = peer.state
  scene.player = peer.actor
  scene.playerBar = peer.bar
  scene.playerFacing = peer.state.facing ?? 'down'
  scene.playerMoving = Boolean(peer.state.moving)
  scene.playerAttacking = Boolean(peer.state.attacking)
  scene.lastAttackAt = peer.state.lastAttackAt ?? 0
  scene.skillReadyAt = peer.state.skillReadyAt ?? 0
  scene.lastContactAt = peer.state.lastContactAt ?? 0
  scene.emitStats = () => {}
  try { return fn() }
  finally {
    peer.state.facing = scene.playerFacing
    peer.state.moving = scene.playerMoving
    peer.state.attacking = scene.playerAttacking
    peer.state.lastAttackAt = scene.lastAttackAt
    peer.state.skillReadyAt = scene.skillReadyAt
    peer.state.lastContactAt = scene.lastContactAt
    scene.playerState = saved.playerState
    scene.player = saved.player
    scene.playerBar = saved.playerBar
    scene.playerFacing = saved.playerFacing
    scene.playerMoving = saved.playerMoving
    scene.playerAttacking = saved.playerAttacking
    scene.lastAttackAt = saved.lastAttackAt
    scene.skillReadyAt = saved.skillReadyAt
    scene.lastContactAt = saved.lastContactAt
    scene.emitStats = saved.emitStats
  }
}

function nearestCombatant(scene, peer, enemy) {
  if (!living(peer.state)) return 'host'
  if (!living(scene.playerState)) return 'peer'
  return distance(enemy, peer.state) < distance(enemy, scene.playerState) ? 'peer' : 'host'
}

function peerAutoPickup(scene, peer) {
  if (!living(peer.state)) return
  for (let index = (scene.drops?.length ?? 0) - 1; index >= 0; index--) {
    const drop = scene.drops[index]
    if (distance(drop, peer.state) > 34) continue
    peer.state = applyPickup(peer.state, drop.item, peer.state.baseStats)
    scene.destroyDrop?.(drop)
    scene.drops.splice(index, 1)
  }
}

function peerAutoAttack(scene, peer, time) {
  if (!living(peer.state) || time - (peer.state.lastAttackAt ?? 0) < attackInterval(peer.state, time)) return
  const target = nearestTarget(peer.state, scene.enemies ?? [])
  if (!target || distance(target, peer.state) > 165) return
  peerContext(scene, peer, () => scene.autoAttack?.(time))
}

function peerSkill(scene, peer, time) {
  if (!living(peer.state) || time < (peer.state.skillReadyAt ?? 0)) return false
  const profile = skillProfile(peer.state)
  peer.state.skillReadyAt = time + profile.cooldown
  peerContext(scene, peer, () => {
    for (const enemy of scene.enemies ?? []) {
      if (enemy.hp > 0 && distance(enemy, peer.state) <= profile.radius) {
        scene.damageEnemy?.(enemy, Math.round(peer.state.damage * 1.6), true, 28, { direct: false, canProc: false, source: 'skill' })
      }
    }
    const ring = scene.add?.circle?.(peer.state.x, peer.state.y, 20, 0x67a8ff, 0.1)?.setStrokeStyle?.(4, 0x67a8ff, 0.9)
    if (ring) scene.tweens?.add?.({ targets: ring, radius: profile.radius, alpha: 0, duration: 320, onComplete: () => ring.destroy?.() })
  })
  return true
}

function mirrorDrops(scene, state, cache) {
  const signature = snapshotSignature(state?.drops ?? [])
  if (signature === cache.dropSignature) return
  cache.dropSignature = signature
  scene.clearDrops?.()
  for (const drop of state?.drops ?? []) scene.spawnDrop?.(drop.x, drop.y, drop.item)
}

function mirrorPortal(scene, portal) {
  if (!portal) { scene.destroyPortal?.(); return }
  if (!scene.portal) {
    const glow = scene.add?.circle?.(portal.x, portal.y, 40, 0x70ff9f, 0.08)?.setDepth?.(8)
    const ring = scene.add?.circle?.(portal.x, portal.y, 27, 0x1f5132, 0.28)?.setStrokeStyle?.(4, 0x70ff9f, 0.9)?.setDepth?.(9)
    const core = scene.add?.circle?.(portal.x, portal.y, 16, 0x70ff9f, 0.42)?.setDepth?.(10)
    if (glow) scene.tweens?.add?.({ targets: glow, scale: 1.3, alpha: 0.18, duration: 850, yoyo: true, repeat: -1 })
    if (ring) scene.tweens?.add?.({ targets: ring, scale: 1.12, alpha: 0.62, duration: 620, yoyo: true, repeat: -1 })
    if (core) scene.tweens?.add?.({ targets: core, alpha: 0.72, duration: 420, yoyo: true, repeat: -1 })
    scene.portal = { x: portal.x, y: portal.y, glow, ring, core, unlockAt: portal.unlockAt ?? 0 }
  }
  scene.portal.x = portal.x
  scene.portal.y = portal.y
  scene.portal.unlockAt = portal.unlockAt ?? scene.portal.unlockAt
  for (const object of [scene.portal.glow, scene.portal.ring, scene.portal.core]) object?.setPosition?.(portal.x, portal.y)
}

function reconcileLocalPlayer(scene, authoritative) {
  if (!authoritative) return
  const gap = distance(scene.playerState, authoritative)
  applyPlayerSnapshot(scene.playerState, authoritative, { preservePosition: gap < 48 })
  if (gap >= 48) scene.player?.setPosition?.(scene.playerState.x, scene.playerState.y)
  scene.updateHealthBar?.(scene.playerBar, scene.playerState.x, scene.playerState.y - 42, scene.playerState.hp, scene.playerState.maxHp)
  scene.emitStats?.()
}

export function installDungeonMultiplayer(scene, {
  role,
  sendInput = () => {},
  sendState = () => {},
  onProgress = () => {},
  onGameOver = () => {},
} = {}) {
  if (!scene || !['host', 'guest'].includes(role)) return null
  if (scene.__dungeonMultiplayer) return scene.__dungeonMultiplayer

  const peerState = makePeerState(scene)
  const peer = { state: peerState, ...makePeerVisual(scene, peerState) }
  syncActor(scene, peer, peer.state)
  const restorers = []
  let lastInputAt = 0
  let lastSnapshotAt = 0
  let sequence = 0
  let lastSnapshotFloor = null
  let latestProgress = scene.__infiniteDungeon?.getProgress?.() ?? { floor: scene.floor ?? 1 }
  const cache = { dropSignature: '' }
  const originalUpdate = scene.update
  const originalAutoAttack = scene.autoAttack
  const originalTrySkill = scene.trySkill

  if (role === 'host') {
    for (const method of ['moveEnemyTowardPlayer', 'updateRangedEnemy', 'updateBoss']) {
      const original = scene[method]
      if (typeof original !== 'function') continue
      scene[method] = function (enemy, ...args) {
        if (nearestCombatant(scene, peer, enemy) === 'peer') return peerContext(scene, peer, () => original.call(scene, enemy, ...args))
        return original.call(scene, enemy, ...args)
      }
      restorers.push(() => { scene[method] = original })
    }

    const originalProjectiles = scene.updateEnemyProjectiles
    if (typeof originalProjectiles === 'function') {
      scene.updateEnemyProjectiles = function (dt) {
        for (let index = scene.enemyProjectiles.length - 1; index >= 0; index--) {
          const projectile = scene.enemyProjectiles[index]
          if (!living(peer.state) || distance(projectile, peer.state) > 20) continue
          peerContext(scene, peer, () => scene.hitPlayer?.(projectile.damage))
          projectile.visual?.destroy?.()
          projectile.glow?.destroy?.()
          scene.enemyProjectiles.splice(index, 1)
        }
        return originalProjectiles.call(scene, dt)
      }
      restorers.push(() => { scene.updateEnemyProjectiles = originalProjectiles })
    }
  } else {
    scene.__dungeonMirrorMode = true
    const interactKey = scene.input?.keyboard?.addKey?.('E')
    interactKey?.removeAllListeners?.('down')
    for (const method of ['updateEnemies', 'updateEnemyProjectiles', 'updateDrops', 'updatePortal']) {
      const original = scene[method]
      if (typeof original !== 'function') continue
      scene[method] = () => {}
      restorers.push(() => { scene[method] = original })
    }
    scene.autoAttack = function guestVisualAutoAttack(time) {
      const damageEnemy = scene.damageEnemy
      const healPlayer = scene.healPlayer
      const applyWeaponProcs = scene.applyWeaponProcs
      scene.damageEnemy = () => {}
      scene.healPlayer = () => {}
      scene.applyWeaponProcs = () => {}
      try { return originalAutoAttack?.call(scene, time) }
      finally { scene.damageEnemy = damageEnemy; scene.healPlayer = healPlayer; scene.applyWeaponProcs = applyWeaponProcs }
    }
    scene.trySkill = function guestSkill(time) {
      const Phaser = globalThis.Phaser
      if (!Phaser?.Input?.Keyboard?.JustDown?.(scene.keys?.SPACE) || time < scene.skillReadyAt) return
      const profile = skillProfile(scene.playerState)
      scene.skillReadyAt = time + profile.cooldown
      sendInput({ x: scene.playerState.x, y: scene.playerState.y, facing: scene.playerFacing, moving: scene.playerMoving, skill: true })
      const ring = scene.add?.circle?.(scene.playerState.x, scene.playerState.y, 20, 0x67a8ff, 0.1)?.setStrokeStyle?.(4, 0x67a8ff, 0.9)
      if (ring) scene.tweens?.add?.({ targets: ring, radius: profile.radius, alpha: 0, duration: 320, onComplete: () => ring.destroy?.() })
    }
    restorers.push(() => { scene.autoAttack = originalAutoAttack; scene.trySkill = originalTrySkill; delete scene.__dungeonMirrorMode })
  }

  scene.update = function multiplayerUpdate(time, delta, ...rest) {
    const result = originalUpdate.call(scene, time, delta, ...rest)
    if (role === 'host') {
      peerAutoAttack(scene, peer, time)
      peerAutoPickup(scene, peer)
      syncActor(scene, peer, peer.state)
      if (scene.portal && time >= scene.portal.unlockAt && distance(scene.portal, peer.state) <= 38) scene.advanceFloor?.()
      if (time - lastSnapshotAt >= SNAPSHOT_INTERVAL_MS) {
        lastSnapshotAt = time
        sequence++
        latestProgress = scene.__infiniteDungeon?.getProgress?.() ?? latestProgress
        const snapshotFloor = latestProgress?.floor ?? scene.floor
        const includeGeometry = shouldIncludeGeometry(sequence) || snapshotFloor !== lastSnapshotFloor
        sendState(createDungeonSnapshot(scene, peer.state, latestProgress, { includeGeometry }))
        lastSnapshotFloor = snapshotFloor
      }
    } else if (time - lastInputAt >= INPUT_INTERVAL_MS) {
      lastInputAt = time
      sendInput({ x: scene.playerState.x, y: scene.playerState.y, facing: scene.playerFacing, moving: scene.playerMoving, attacking: scene.playerAttacking })
      syncActor(scene, peer, peer.state)
    }
    return result
  }
  restorers.push(() => { scene.update = originalUpdate })

  const api = {
    role,
    receiveInput(input = {}) {
      if (role !== 'host') return
      const geometry = scene.__roomGeometry
      const minX = PLAYER_RADIUS, minY = PLAYER_RADIUS
      const maxX = Math.max(minX, (geometry?.width ?? 960) - PLAYER_RADIUS)
      const maxY = Math.max(minY, (geometry?.height ?? 600) - PLAYER_RADIUS)
      if (Number.isFinite(Number(input.x))) peer.state.x = Math.max(minX, Math.min(maxX, Number(input.x)))
      if (Number.isFinite(Number(input.y))) peer.state.y = Math.max(minY, Math.min(maxY, Number(input.y)))
      peer.state.facing = input.facing ?? peer.state.facing
      peer.state.moving = Boolean(input.moving)
      peer.state.attacking = Boolean(input.attacking)
      if (input.skill) peerSkill(scene, peer, scene.time?.now ?? 0)
      syncActor(scene, peer, peer.state)
    },
    receiveState(state = {}) {
      if (role !== 'guest' || !state) return
      const incomingFloor = state.progress?.floor ?? state.floor
      if (incomingFloor && incomingFloor !== scene.floor) {
        scene.floor = incomingFloor
        scene.floorCleared = Boolean(state.floorCleared)
        scene.clearEnemies?.()
        scene.clearEnemyProjectiles?.()
        scene.clearDrops?.()
        scene.destroyPortal?.()
        cache.dropSignature = ''
      }
      if (state.geometry) scene.__dungeonSpatial?.refreshRoom?.({ geometry: state.geometry })
      scene.floorCleared = Boolean(state.floorCleared)
      scene.runComplete = Boolean(state.runComplete)
      applyEnemySnapshot(scene, state.enemies ?? [])
      mirrorDrops(scene, state, cache)
      mirrorPortal(scene, state.portal)
      reconcileLocalPlayer(scene, state.peer)
      applyPlayerSnapshot(peer.state, state.host)
      peer.state.facing = state.host?.facing ?? peer.state.facing
      peer.state.moving = Boolean(state.host?.moving)
      peer.state.attacking = Boolean(state.host?.attacking)
      syncActor(scene, peer, peer.state)
      latestProgress = state.progress ?? latestProgress
      onProgress(latestProgress)
      if (state.dead && !cache.gameOverNotified) { cache.gameOverNotified = true; scene.dead = true; onGameOver() }
    },
    destroy() {
      while (restorers.length) restorers.pop()()
      peer.actor?.destroy?.()
      scene.destroyHealthBar?.(peer.bar)
      delete scene.__dungeonMultiplayer
    },
    getPeerState: () => structuredClone(peer.state),
  }
  scene.__dungeonMultiplayer = api
  scene.events?.once?.('shutdown', () => api.destroy())
  return api
}
