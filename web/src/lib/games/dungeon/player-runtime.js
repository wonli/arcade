import { activeTrapAt } from './dungeon3-hazards.js'
import {
  attackInterval,
  bossReward,
  healFromHit,
  modifiedDamage,
  nearestTarget,
  rollDamage,
  rollEquipment,
  rollPotion,
  secondaryTarget,
  skillProfile,
} from './combat.js'
import { directionFromInput } from './scene.js'
import { findPath, nextWaypoint } from './pathfinding.js'
import { circleHitsSolid, clipSegmentToSolids, movementWithCollision } from './spatial.js'
import { allPlayersDead, livingPlayers, nearestLivingPlayer } from './player-targeting.js'
import { createPlayerContext, mergeDungeonInput, normalizeDungeonInput } from './player-context.js'

const PLAYER_RADIUS = 18
const ENEMY_RADIUS = 15
const PATH_REFRESH_MS = 520

function clone(value) {
  if (value == null) return value
  return typeof structuredClone === 'function'
    ? structuredClone(value)
    : JSON.parse(JSON.stringify(value))
}

function enemyIsFlying(enemy) {
  if (enemy?.flying || enemy?.airborne) return true
  return /(?:bat|dragon|ghost|wing|fly)/i.test(String(enemy?.type ?? enemy?.archetype ?? enemy?.id ?? ''))
}

function collisionGeometryForEnemy(enemy, geometry) {
  return enemyIsFlying(enemy) && geometry ? { ...geometry, water: [] } : geometry
}

function createLocalContext(scene) {
  const player = { id: 'local', local: true, dead: false, input: normalizeDungeonInput() }
  Object.defineProperties(player, {
    state: { get: () => scene.playerState, set: (value) => { scene.playerState = value }, enumerable: true },
    actor: { get: () => scene.player, set: (value) => { scene.player = value }, enumerable: true },
    bar: { get: () => scene.playerBar, set: (value) => { scene.playerBar = value }, enumerable: true },
    facing: { get: () => scene.playerFacing, set: (value) => { scene.playerFacing = value }, enumerable: true },
    moving: { get: () => scene.playerMoving, set: (value) => { scene.playerMoving = Boolean(value) }, enumerable: true },
    attacking: { get: () => scene.playerAttacking, set: (value) => { scene.playerAttacking = Boolean(value) }, enumerable: true },
    lastAttackAt: { get: () => scene.lastAttackAt, set: (value) => { scene.lastAttackAt = Number(value) || 0 }, enumerable: true },
    skillReadyAt: { get: () => scene.skillReadyAt, set: (value) => { scene.skillReadyAt = Number(value) || 0 }, enumerable: true },
    lastContactAt: { get: () => scene.lastContactAt, set: (value) => { scene.lastContactAt = Number(value) || 0 }, enumerable: true },
  })
  return player
}

function updatePlayerVisual(scene, player) {
  const state = player?.state
  if (!state) return
  player.actor?.setPosition?.(state.x, state.y)
  player.marker?.setPosition?.(state.x, state.y + 25)
  player.label?.setPosition?.(state.x, state.y - 54)
  scene.updateHealthBar?.(player.bar, state.x, state.y - 42, state.hp, state.maxHp)
}

function makeRemoteVisual(scene, player) {
  const state = player.state
  player.marker = scene.add?.circle?.(state.x, state.y + 25, 19, 0x67a8ff, 0.06)?.setStrokeStyle?.(2, 0x67a8ff, 0.9)?.setDepth?.(18) ?? null
  player.label = scene.add?.text?.(state.x, state.y - 54, 'P2', {
    fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
    fontSize: '10px',
    fontStyle: 'bold',
    color: '#8bc4ff',
    stroke: '#08090b',
    strokeThickness: 3,
  })?.setOrigin?.(0.5)?.setDepth?.(22) ?? null
}

export function installDungeonPlayerRuntime(scene) {
  if (!scene || scene.__dungeonPlayerRuntime) return scene?.__dungeonPlayerRuntime ?? null

  const original = {
    updatePlayer: scene.updatePlayer?.bind(scene),
    syncPlayerAnimation: scene.syncPlayerAnimation?.bind(scene),
    hitPlayer: scene.hitPlayer?.bind(scene),
    flashPlayer: scene.flashPlayer?.bind(scene),
    moveEnemyTowardPlayer: scene.moveEnemyTowardPlayer?.bind(scene),
    updateRangedEnemy: scene.updateRangedEnemy?.bind(scene),
    fireEnemyProjectile: scene.fireEnemyProjectile?.bind(scene),
    updateEnemyProjectiles: scene.updateEnemyProjectiles?.bind(scene),
    updateBoss: scene.updateBoss?.bind(scene),
    bossCharge: scene.bossCharge?.bind(scene),
    bossShockwave: scene.bossShockwave?.bind(scene),
    syncEnemyVisual: scene.syncEnemyVisual?.bind(scene),
    autoAttack: scene.autoAttack?.bind(scene),
    trySkill: scene.trySkill?.bind(scene),
    slash: scene.slash?.bind(scene),
    healPlayer: scene.healPlayer?.bind(scene),
    applyWeaponProcs: scene.applyWeaponProcs?.bind(scene),
    damageEnemy: scene.damageEnemy?.bind(scene),
    killEnemy: scene.killEnemy?.bind(scene),
    updatePortal: scene.updatePortal?.bind(scene),
    startFloor: scene.startFloor?.bind(scene),
  }

  const localPlayer = createLocalContext(scene)
  const players = [localPlayer]
  const trapCooldown = new Map()
  const interactKey = scene.input?.keyboard?.addKey?.('E') ?? null
  scene.localPlayer = localPlayer

  const activePlayers = () => players.filter(Boolean)
  const playerById = (id) => activePlayers().find((player) => player.id === id) ?? null
  const nearestPlayer = (origin) => nearestLivingPlayer(origin, activePlayers()) ?? localPlayer

  function readKeyboardInput(player) {
    if (!player.local) return normalizeDungeonInput(player.input)
    const keys = scene.keys ?? {}
    const moveX = (keys.D?.isDown ? 1 : 0) - (keys.A?.isDown ? 1 : 0)
    const moveY = (keys.S?.isDown ? 1 : 0) - (keys.W?.isDown ? 1 : 0)
    const skillDown = Boolean(keys.SPACE?.isDown || keys.SPACE?._justDown)
    const interactDown = Boolean(interactKey?.isDown || interactKey?._justDown)
    const skill = Boolean(keys.SPACE?._justDown || (skillDown && !player.__skillHeld))
    const interact = Boolean(interactKey?._justDown || (interactDown && !player.__interactHeld))
    player.__skillHeld = skillDown
    player.__interactHeld = interactDown
    return normalizeDungeonInput({ moveX, moveY, skill, interact })
  }

  function readLocalInput() {
    const keyboard = readKeyboardInput(localPlayer)
    const touch = scene.__dungeonTouchInput?.consumeInput?.() ?? scene.__dungeonTouchInput?.getState?.() ?? null
    return mergeDungeonInput(keyboard, touch)
  }

  function syncAnimation(player = localPlayer, forceAction = null) {
    if (!player?.actor) return
    if (player === localPlayer && original.syncPlayerAnimation) {
      original.syncPlayerAnimation(forceAction)
      return
    }
    const actor = player.actor
    if (!actor?.anims) return
    const action = forceAction || (player.moving ? 'walk' : 'idle')
    const sheetDirection = player.facing === 'up' ? 'up' : player.facing === 'down' ? 'down' : 'side'
    const key = `dungeon-player-${sheetDirection}-${action}`
    actor.setFlipX?.(player.facing === 'left')
    if (scene.anims?.exists?.(key) && actor.anims.currentAnim?.key !== key) actor.play?.(key, true)
  }

  function movePlayer(dt, player = localPlayer, input = null) {
    if (!player || player.dead || (player.state?.hp ?? 0) <= 0) return normalizeDungeonInput()
    const nextInput = normalizeDungeonInput(input ?? (player.local ? readLocalInput() : player.input))
    player.input = nextInput
    if ((scene.__hitStopUntil ?? 0) > scene.time.now) {
      player.moving = false
      if (!player.attacking) syncAnimation(player)
      return nextInput
    }

    const state = player.state
    const before = { x: state.x, y: state.y }
    const dx = nextInput.moveX
    const dy = nextInput.moveY
    player.facing = directionFromInput(dx, dy, player.facing)
    player.moving = Boolean(dx || dy)
    const hurtBoost = (state.hasteUntil ?? 0) > scene.time.now ? 1 + (state.effects?.hurtHaste ?? 0) : 1
    const length = Math.hypot(dx, dy) || 1
    const desired = {
      x: dx ? (dx / length) * state.speed * hurtBoost * dt : 0,
      y: dy ? (dy / length) * state.speed * hurtBoost * dt : 0,
    }
    const next = scene.__roomGeometry
      ? movementWithCollision(before, desired, PLAYER_RADIUS, scene.__roomGeometry)
      : { x: before.x + desired.x, y: before.y + desired.y }
    state.x = Math.max(66, Math.min((scene.__roomGeometry?.width ?? 960) - 66, next.x))
    state.y = Math.max(66, Math.min((scene.__roomGeometry?.height ?? 600) - 66, next.y))
    updatePlayerVisual(scene, player)

    const trap = activeTrapAt(state, scene.__roomGeometry, scene.time.now)
    const cooldown = trapCooldown.get(player.id) ?? 0
    if (trap && scene.time.now >= cooldown) {
      trapCooldown.set(player.id, scene.time.now + 850)
      scene.hitPlayer?.(trap.kind === 'spikes' || trap.kind === 'wall-trap' ? 6 : 4, player)
    }
    if (!player.attacking) syncAnimation(player)
    return nextInput
  }

  function flashPlayer(player = localPlayer) {
    const actor = player?.actor
    if (actor?.setTintFill) {
      actor.setTintFill(0xff5f6d)
      scene.time?.delayedCall?.(90, () => actor?.clearTint?.())
    }
    scene.cameras?.main?.shake?.(70, 0.003)
  }

  function hitPlayer(damage, player = localPlayer) {
    if (!player || player.dead || (player.state?.hp ?? 0) <= 0) return
    player.lastContactAt = scene.time.now
    const state = player.state
    state.hp = Math.max(0, state.hp - damage)
    if ((state.effects?.hurtHaste ?? 0) > 0) state.hasteUntil = scene.time.now + 1800
    updatePlayerVisual(scene, player)
    flashPlayer(player)
    if (player.local) scene.emitStats?.()
    if (state.hp > 0) return
    player.dead = true
    player.moving = false
    player.attacking = false
    player.actor?.setAlpha?.(0.38)
    player.marker?.setAlpha?.(0.12)
    if (allPlayersDead(activePlayers())) scene.gameOver?.()
  }

  function navigateEnemy(enemy, targetPlayer, time, dt) {
    const geometry = scene.__roomGeometry
    if (!enemy || !targetPlayer?.state || !geometry || (scene.__hitStopUntil ?? 0) > time) return
    const target = targetPlayer.state
    const flying = enemyIsFlying(enemy)
    const collisionGeometry = collisionGeometryForEnemy(enemy, geometry)
    const directEnd = clipSegmentToSolids(enemy, target, collisionGeometry, 3)
    let destination = target
    const forcePath = !flying && (geometry.water?.length ?? 0) > 0
    if (directEnd.blocked || forcePath) {
      const needsRefresh = !enemy.navPath?.length || time >= (enemy.navRefreshAt ?? 0)
      if (needsRefresh) {
        enemy.navPath = findPath(scene.__navGrids?.[flying ? 'flying' : enemy.boss ? 'boss' : 'ground'] ?? scene.__navGrid, enemy, target)
        enemy.navRefreshAt = time + PATH_REFRESH_MS + ((enemy.id?.length ?? 0) % 7) * 37
      }
      destination = nextWaypoint(enemy.navPath, enemy, geometry.grid ? 8 : 20) ?? target
    } else enemy.navPath = []
    const dx = destination.x - enemy.x
    const dy = destination.y - enemy.y
    const distance = Math.hypot(dx, dy) || 1
    const next = movementWithCollision(
      enemy,
      { x: (dx / distance) * enemy.speed * dt, y: (dy / distance) * enemy.speed * dt },
      enemy.hitRadius ?? ENEMY_RADIUS,
      collisionGeometry,
    )
    enemy.x = next.x
    enemy.y = next.y
  }

  function syncEnemyVisual(enemy, time, targetPlayer = null) {
    const target = targetPlayer?.state ? targetPlayer : nearestPlayer(enemy)
    const state = target?.state
    const dx = state ? state.x - enemy.x : 0
    const dy = state ? state.y - enemy.y : 0
    const distance = Math.hypot(dx, dy) || 1
    enemy.visual?.setPosition?.(enemy.x, enemy.y)
    scene.updateHealthBar?.(enemy.healthBar, enemy.x, enemy.y - enemy.barOffset, enemy.hp, enemy.maxHp)
    if (enemy.visual?.setFlipX && Math.abs(dx) > 1) enemy.visual.setFlipX(dx < 0)
    if (time < enemy.hitUntil) enemy.visual?.setTintFill?.(0xffffff)
    else if (enemy.boss && enemy.phase === 2) enemy.visual?.setTint?.(0xff705c)
    else if (enemy.tint) enemy.visual?.setTint?.(enemy.tint)
    else enemy.visual?.clearTint?.()
    const contactRadius = enemy.boss ? 42 : 30 + Math.max(0, enemy.scale - 1) * 12
    if (target && distance < contactRadius && time - target.lastContactAt > 420) hitPlayer(enemy.contactDamage, target)
  }

  function moveEnemyTowardPlayer(enemy, time, dt, targetPlayer = null) {
    const target = targetPlayer?.state ? targetPlayer : nearestPlayer(enemy)
    if (!target) return
    navigateEnemy(enemy, target, time, dt)
    syncEnemyVisual(enemy, time, target)
  }

  function fireEnemyProjectile(enemy, targetPlayer = null) {
    const target = targetPlayer?.state ? targetPlayer : nearestPlayer(enemy)
    if (!target?.state) return
    const dx = target.state.x - enemy.x
    const dy = target.state.y - enemy.y
    const distance = Math.hypot(dx, dy) || 1
    const speed = enemy.projectileSpeed || 260
    const visual = scene.add?.circle?.(enemy.x, enemy.y - 4, 7, 0x70f2ce, 0.92)?.setStrokeStyle?.(2, 0xd6fff3, 0.9)?.setDepth?.(24)
    const glow = scene.add?.circle?.(enemy.x, enemy.y - 4, 13, 0x70f2ce, 0.16)?.setDepth?.(23)
    scene.enemyProjectiles.push({
      x: enemy.x,
      y: enemy.y - 4,
      vx: (dx / distance) * speed,
      vy: (dy / distance) * speed,
      damage: enemy.projectileDamage || 12,
      life: 3,
      visual,
      glow,
    })
  }

  function updateRangedEnemy(enemy, time, dt, targetPlayer = null) {
    if ((scene.__hitStopUntil ?? 0) > time) return
    const target = targetPlayer?.state ? targetPlayer : nearestPlayer(enemy)
    if (!target?.state) return
    const dx = target.state.x - enemy.x
    const dy = target.state.y - enemy.y
    const distance = Math.hypot(dx, dy) || 1
    const preferred = enemy.preferredRange || 180
    const collisionGeometry = collisionGeometryForEnemy(enemy, scene.__roomGeometry)
    const los = clipSegmentToSolids(enemy, target.state, collisionGeometry, 3)
    if (distance > enemy.attackRange || los.blocked) navigateEnemy(enemy, target, time, dt)
    else if (distance < preferred - 34) {
      const next = movementWithCollision(enemy, {
        x: -(dx / distance) * enemy.speed * 0.72 * dt,
        y: -(dy / distance) * enemy.speed * 0.72 * dt,
      }, enemy.hitRadius ?? ENEMY_RADIUS, collisionGeometry)
      enemy.x = next.x
      enemy.y = next.y
    } else {
      const strafe = Math.sin((time + enemy.x * 7) / 650) * enemy.speed * 0.28 * dt
      const next = movementWithCollision(enemy, {
        x: (-dy / distance) * strafe,
        y: (dx / distance) * strafe,
      }, enemy.hitRadius ?? ENEMY_RADIUS, collisionGeometry)
      enemy.x = next.x
      enemy.y = next.y
    }
    syncEnemyVisual(enemy, time, target)
    const nextDistance = Math.hypot(target.state.x - enemy.x, target.state.y - enemy.y) || 1
    if (!clipSegmentToSolids(enemy, target.state, collisionGeometry, 3).blocked && nextDistance <= enemy.attackRange && time >= enemy.nextProjectileAt) {
      enemy.nextProjectileAt = time + enemy.projectileCooldown
      fireEnemyProjectile(enemy, target)
    }
  }

  function updateEnemyProjectiles(dt) {
    if ((scene.__hitStopUntil ?? 0) > scene.time.now) return
    const projectileGeometry = scene.__roomGeometry ? { ...scene.__roomGeometry, water: [] } : scene.__roomGeometry
    for (let index = scene.enemyProjectiles.length - 1; index >= 0; index--) {
      const projectile = scene.enemyProjectiles[index]
      const next = { x: projectile.x + projectile.vx * dt, y: projectile.y + projectile.vy * dt }
      projectile.life -= dt
      const wallHit = projectileGeometry ? circleHitsSolid(next, 5, projectileGeometry) : false
      if (!wallHit) {
        projectile.x = next.x
        projectile.y = next.y
        projectile.visual?.setPosition?.(projectile.x, projectile.y)
        projectile.glow?.setPosition?.(projectile.x, projectile.y)
      }
      const target = !wallHit
        ? livingPlayers(activePlayers()).find((player) => Math.hypot(projectile.x - player.state.x, projectile.y - player.state.y) <= 20)
        : null
      const expired = projectile.life <= 0
      if (!wallHit && !target && !expired) continue
      if (target) hitPlayer(projectile.damage, target)
      projectile.visual?.destroy?.()
      projectile.glow?.destroy?.()
      scene.enemyProjectiles.splice(index, 1)
    }
  }

  function bossCharge(enemy, targetPlayer = null) {
    const target = targetPlayer?.state ? targetPlayer : nearestPlayer(enemy)
    if (!target?.state) return
    const dx = target.state.x - enemy.x
    const dy = target.state.y - enemy.y
    const distance = Math.hypot(dx, dy) || 1
    const targetId = target.id
    const line = scene.add?.rectangle?.(enemy.x + dx / 2, enemy.y + dy / 2, distance, 7, 0xff665e, 0.26)?.setOrigin?.(0.5)?.setRotation?.(Math.atan2(dy, dx))?.setDepth?.(24)
    if (line) scene.tweens?.add?.({ targets: line, alpha: 0.72, duration: 320, yoyo: true, onComplete: () => line.destroy?.() })
    scene.time?.delayedCall?.(420, () => {
      if (enemy.hp <= 0 || scene.dead) return
      const nextTarget = playerById(targetId)
      if (!nextTarget || nextTarget.dead) return
      const nextDx = nextTarget.state.x - enemy.x
      const nextDy = nextTarget.state.y - enemy.y
      const nextDistance = Math.hypot(nextDx, nextDy) || 1
      const speed = enemy.phase === 2 ? 430 : 360
      enemy.chargeVx = (nextDx / nextDistance) * speed
      enemy.chargeVy = (nextDy / nextDistance) * speed
      enemy.chargeTargetId = targetId
      enemy.chargingUntil = scene.time.now + 560
    })
  }

  function bossShockwave(enemy) {
    const telegraph = scene.add?.circle?.(enemy.x, enemy.y, 34, 0xff8a63, 0.08)?.setStrokeStyle?.(4, 0xff8a63, 0.72)?.setDepth?.(23)
    if (!telegraph) return
    scene.tweens?.add?.({ targets: telegraph, radius: 120, alpha: 0.5, duration: 560, onComplete: () => {
      const ring = scene.add?.circle?.(enemy.x, enemy.y, 120, 0xff665e, 0.04)?.setStrokeStyle?.(7, 0xff665e, 0.9)?.setDepth?.(25)
      if (ring) scene.tweens?.add?.({ targets: ring, radius: 168, alpha: 0, duration: 320, onComplete: () => ring.destroy?.() })
      telegraph.destroy?.()
      for (const player of livingPlayers(activePlayers())) {
        if (Math.hypot(player.state.x - enemy.x, player.state.y - enemy.y) <= 130) hitPlayer(enemy.phase === 2 ? 24 : 18, player)
      }
    } })
  }

  function updateBoss(enemy, time, dt, targetPlayer = null) {
    const target = targetPlayer?.state ? targetPlayer : nearestPlayer(enemy)
    if (!target) return
    if (enemy.phase === 1 && enemy.hp / enemy.maxHp <= enemy.phaseThreshold) {
      enemy.phase = 2
      enemy.speed *= 1.18
      enemy.contactDamage += 5
      enemy.visual?.setTint?.(0xff705c)
      scene.showBanner?.('BOSS PHASE II', '#ff705c', 28)
      scene.cameras?.main?.shake?.(180, 0.008)
    }
    if (time < enemy.chargingUntil) {
      const before = { x: enemy.x, y: enemy.y }
      const collisionGeometry = collisionGeometryForEnemy(enemy, scene.__roomGeometry)
      const desired = { x: enemy.chargeVx * dt, y: enemy.chargeVy * dt }
      const next = collisionGeometry
        ? movementWithCollision(before, desired, enemy.hitRadius ?? 26, collisionGeometry)
        : { x: before.x + desired.x, y: before.y + desired.y }
      enemy.x = next.x
      enemy.y = next.y
      const chargeTarget = playerById(enemy.chargeTargetId) ?? target
      syncEnemyVisual(enemy, time, chargeTarget)
      return
    }
    const chargeCooldown = enemy.phase === 2 ? enemy.chargeCooldown * 0.68 : enemy.chargeCooldown
    const shockwaveCooldown = enemy.phase === 2 ? enemy.shockwaveCooldown * 0.72 : enemy.shockwaveCooldown
    if (time >= enemy.nextShockwaveAt) {
      enemy.nextShockwaveAt = time + shockwaveCooldown
      bossShockwave(enemy)
    }
    if (time >= enemy.nextChargeAt) {
      enemy.nextChargeAt = time + chargeCooldown
      bossCharge(enemy, target)
      return
    }
    moveEnemyTowardPlayer(enemy, time, dt, target)
  }

  function autoAttack(time, player = localPlayer) {
    if (!player || player.dead) return
    if (time - player.lastAttackAt < attackInterval(player.state, time)) return
    const target = nearestTarget(player.state, scene.enemies ?? [])
    if (!target || Math.hypot(target.x - player.state.x, target.y - player.state.y) > 165) return
    player.lastAttackAt = time
    scene.slash?.(target, player)
  }

  function trySkill(time, player = localPlayer, input = null) {
    if (!player || player.dead) return
    const intent = normalizeDungeonInput(input ?? player.input)
    if (!intent.skill || time < player.skillReadyAt) return
    const profile = skillProfile(player.state)
    player.skillReadyAt = time + profile.cooldown
    const ring = scene.add?.circle?.(player.state.x, player.state.y, 20, 0xc1ff56, 0.1)?.setStrokeStyle?.(4, 0xc1ff56, 0.9)
    if (ring) scene.tweens?.add?.({ targets: ring, radius: profile.radius, alpha: 0, duration: 320, onComplete: () => ring.destroy?.() })
    let hits = 0
    for (const enemy of scene.enemies ?? []) {
      if (enemy.hp > 0 && Math.hypot(enemy.x - player.state.x, enemy.y - player.state.y) <= profile.radius) {
        scene.damageEnemy?.(enemy, Math.round(player.state.damage * 1.6), true, 28, { direct: false, canProc: false, source: 'skill' }, player)
        hits++
      }
    }
    scene.cameras?.main?.shake?.(100, 0.006)
    if (player.local) scene.emitStats?.(time)
    scene.__dungeonPlayerEvent?.({ type: 'skill', hits, playerId: player.id })
  }

  function slash(target, player = localPlayer) {
    if (!target || target.hp <= 0 || !player || player.dead) return
    const dx = target.x - player.state.x
    const dy = target.y - player.state.y
    player.facing = directionFromInput(dx, dy, player.facing)
    if (player.actor?.anims) {
      player.attacking = true
      syncAnimation(player, 'attack')
      scene.time?.delayedCall?.(180, () => {
        player.attacking = false
        syncAnimation(player)
      })
    }
    const result = rollDamage(player.state)
    const damage = modifiedDamage(player.state, target, result.damage)
    const angle = Math.atan2(dy, dx)
    const slashVisual = scene.add?.arc?.(
      player.state.x + Math.cos(angle) * 34,
      player.state.y + Math.sin(angle) * 34,
      34,
      -55,
      55,
      false,
      result.critical ? 0xffdd6e : 0xeafbc9,
      0.85,
    )?.setAngle?.(angle * 180 / Math.PI)?.setDepth?.(30)
    if (slashVisual) scene.tweens?.add?.({ targets: slashVisual, alpha: 0, scale: 1.35, duration: 140, onComplete: () => slashVisual.destroy?.() })
    scene.damageEnemy?.(target, damage, result.critical, result.critical ? 34 : 22, { direct: true, canProc: true, source: 'weapon' }, player)
    scene.healPlayer?.(healFromHit(player.state, damage, result.critical, { direct: true }), player)
    scene.applyWeaponProcs?.(target, damage, result.critical, player)
  }

  function healPlayer(amount, player = localPlayer) {
    if (!player || amount <= 0 || player.dead || player.state.hp <= 0) return
    const before = player.state.hp
    player.state.hp = Math.min(player.state.maxHp, player.state.hp + amount)
    if (player.state.hp === before) return
    updatePlayerVisual(scene, player)
    if (player.local) scene.emitStats?.()
  }

  function effectLine(from, to, color, width = 3) {
    const dx = to.x - from.x
    const dy = to.y - from.y
    const distance = Math.hypot(dx, dy) || 1
    const line = scene.add?.rectangle?.(from.x + dx / 2, from.y + dy / 2, distance, width, color, 0.82)?.setRotation?.(Math.atan2(dy, dx))?.setDepth?.(34)
    if (line) scene.tweens?.add?.({ targets: line, alpha: 0, duration: 170, onComplete: () => line.destroy?.() })
  }

  function applyWeaponProcs(primary, damage, critical, player = localPlayer) {
    const effects = player?.state?.effects ?? {}
    if (primary.hp > 0 && effects.piercing > 0 && Math.random() < effects.piercing) {
      const target = secondaryTarget(primary, scene.enemies, 145)
      if (target) {
        effectLine(primary, target, 0xe7f2ff, 2)
        scene.damageEnemy?.(target, Math.max(1, Math.round(damage * 0.72)), false, 12, { direct: false, canProc: false, source: 'piercing' }, player)
      }
    }
    if (effects.chain > 0 && Math.random() < effects.chain) {
      const target = secondaryTarget(primary, scene.enemies, 165)
      if (target) {
        effectLine(primary, target, 0x7bc5ff, 3)
        scene.damageEnemy?.(target, Math.max(1, Math.round(damage * 0.56)), false, 8, { direct: false, canProc: false, source: 'chain' }, player)
      }
    }
    if (critical && effects.thunder > 0 && Math.random() < effects.thunder) {
      let source = primary
      const hit = new Set([primary.id])
      for (let index = 0; index < 2; index++) {
        const target = secondaryTarget(source, scene.enemies.filter((enemy) => !hit.has(enemy.id)), 190)
        if (!target) break
        hit.add(target.id)
        effectLine(source, target, 0x9ae9ff, 5)
        scene.damageEnemy?.(target, Math.max(1, Math.round(damage * 0.68)), false, 5, { direct: false, canProc: false, source: 'thunder' }, player)
        source = target
      }
    }
    if (effects.whirlwind > 0 && Math.random() < effects.whirlwind) {
      const radius = 105
      const ring = scene.add?.circle?.(player.state.x, player.state.y, 24, 0xfff0a8, 0.05)?.setStrokeStyle?.(4, 0xffdd75, 0.9)?.setDepth?.(31)
      if (ring) scene.tweens?.add?.({ targets: ring, radius, alpha: 0, duration: 260, onComplete: () => ring.destroy?.() })
      for (const enemy of scene.enemies ?? []) {
        if (enemy.hp <= 0 || enemy === primary) continue
        if (Math.hypot(enemy.x - player.state.x, enemy.y - player.state.y) <= radius) {
          scene.damageEnemy?.(enemy, Math.max(1, Math.round(damage * 0.5)), false, 16, { direct: false, canProc: false, source: 'whirlwind' }, player)
        }
      }
    }
  }

  function killEnemy(enemy, context = { source: 'effect' }, player = localPlayer) {
    enemy.visual?.setVisible?.(false)
    scene.destroyHealthBar?.(enemy.healthBar)
    enemy.healthBar = null
    scene.kills++
    scene.floorKills++
    const deathColor = enemy.boss ? 0xffd86b : enemy.archetype === 'fast' ? 0x83c8ff : enemy.archetype === 'brute' ? 0xff9e72 : enemy.archetype === 'ranged' ? 0x70f2ce : 0xa980ff
    scene.deathBurst?.(enemy.x, enemy.y, deathColor)
    const corpseBurst = player?.state?.effects?.corpseBurst ?? 0
    if (corpseBurst > 0 && context.source !== 'corpse_burst') {
      const radius = 110
      const burst = scene.add?.circle?.(enemy.x, enemy.y, 18, 0xff8f68, 0.18)?.setStrokeStyle?.(3, 0xffb08c, 0.9)?.setDepth?.(27)
      if (burst) scene.tweens?.add?.({ targets: burst, radius, alpha: 0, duration: 260, onComplete: () => burst.destroy?.() })
      const burstDamage = Math.max(1, Math.round(player.state.damage * corpseBurst))
      for (const target of scene.enemies ?? []) {
        if (target === enemy || target.hp <= 0) continue
        if (Math.hypot(target.x - enemy.x, target.y - enemy.y) <= radius) {
          scene.damageEnemy?.(target, burstDamage, false, 12, { direct: false, canProc: false, source: 'corpse_burst' }, player)
        }
      }
    }
    const equipment = enemy.boss ? bossReward(Math.random, scene.floor) : rollEquipment(scene.floor)
    const potion = rollPotion()
    if (equipment) scene.spawnDrop?.(enemy.x - (potion ? 12 : 0), enemy.y, equipment)
    if (potion) scene.spawnDrop?.(enemy.x + (equipment ? 12 : 0), enemy.y, potion)
    if (player?.local) scene.emitStats?.()
    scene.checkFloorClear?.()
    scene.time?.delayedCall?.(350, () => {
      const index = scene.enemies.indexOf(enemy)
      if (index >= 0) scene.enemies.splice(index, 1)
      enemy.visual?.destroy?.()
    })
  }

  function damageEnemy(enemy, damage, critical, knockback, context = { direct: false, canProc: false, source: 'effect' }, player = localPlayer) {
    if (!enemy || enemy.hp <= 0) return
    enemy.hp = Math.max(0, enemy.hp - damage)
    enemy.hitUntil = scene.time.now + 90
    const source = player?.state ?? localPlayer.state
    const dx = enemy.x - source.x
    const dy = enemy.y - source.y
    const distance = Math.hypot(dx, dy) || 1
    const effectiveKnockback = enemy.boss ? knockback * 0.2 : knockback
    enemy.x += (dx / distance) * effectiveKnockback
    enemy.y += (dy / distance) * effectiveKnockback
    scene.updateHealthBar?.(enemy.healthBar, enemy.x, enemy.y - enemy.barOffset, enemy.hp, enemy.maxHp)
    scene.damageText?.(enemy.x, enemy.y - 16, damage, critical)
    if (critical) scene.cameras?.main?.shake?.(70, 0.004)
    if (enemy.hp <= 0) killEnemy(enemy, context, player)
  }

  function repositionRemotePlayers() {
    const geometry = scene.__roomGeometry
    if (!geometry) return
    let offset = 1
    for (const player of activePlayers()) {
      if (player.local) continue
      const start = localPlayer.state
      const next = movementWithCollision(start, { x: 42 * offset, y: 0 }, PLAYER_RADIUS, geometry)
      player.state.x = next.x
      player.state.y = next.y
      player.dead = false
      player.state.hp = Math.max(1, player.state.hp)
      player.actor?.setAlpha?.(1)
      updatePlayerVisual(scene, player)
      offset++
    }
  }

  function startFloor(...args) {
    const result = original.startFloor?.(...args)
    repositionRemotePlayers()
    return result
  }

  function updatePortal(time) {
    if (!scene.portal || time < scene.portal.unlockAt) return
    const reached = livingPlayers(activePlayers()).some((player) => Math.hypot(scene.portal.x - player.state.x, scene.portal.y - player.state.y) <= 38)
    if (reached) scene.advanceFloor?.()
  }

  function addPlayer({ id, state = null, x = null, y = null, facing = 'down' } = {}) {
    if (!id) return null
    const existing = playerById(id)
    if (existing) return existing
    const source = state ? clone(state) : clone(localPlayer.state)
    source.x = Number.isFinite(Number(x)) ? Number(x) : (localPlayer.state.x ?? 480) + 42
    source.y = Number.isFinite(Number(y)) ? Number(y) : (localPlayer.state.y ?? 300)
    const actor = scene.makeActor?.(source.x, source.y, 'player')?.setDepth?.(19) ?? null
    const bar = scene.createHealthBar?.(source.x, source.y - 42, 54, 6, 0x67a8ff) ?? null
    const player = createPlayerContext({ id, state: source, actor, bar, facing })
    makeRemoteVisual(scene, player)
    players.push(player)
    repositionRemotePlayers()
    return player
  }

  function removePlayer(id) {
    const index = players.findIndex((player) => !player.local && player.id === id)
    if (index < 0) return
    const [player] = players.splice(index, 1)
    player.actor?.destroy?.()
    player.marker?.destroy?.()
    player.label?.destroy?.()
    scene.destroyHealthBar?.(player.bar)
    trapCooldown.delete(player.id)
  }

  scene.updatePlayer = function updateDungeonPlayer(dt, player = localPlayer, input = null) { return movePlayer(dt, player, input) }
  scene.syncPlayerAnimation = function syncDungeonPlayerAnimation(forceAction = null, player = localPlayer) { return syncAnimation(player, forceAction) }
  scene.hitPlayer = function hitDungeonPlayer(damage, player = localPlayer) { return hitPlayer(damage, player) }
  scene.flashPlayer = function flashDungeonPlayer(player = localPlayer) { return flashPlayer(player) }
  scene.moveEnemyTowardPlayer = function moveEnemy(enemy, time, dt, targetPlayer = null) { return moveEnemyTowardPlayer(enemy, time, dt, targetPlayer) }
  scene.updateRangedEnemy = function rangedEnemy(enemy, time, dt, targetPlayer = null) { return updateRangedEnemy(enemy, time, dt, targetPlayer) }
  scene.fireEnemyProjectile = function fireProjectile(enemy, targetPlayer = null) { return fireEnemyProjectile(enemy, targetPlayer) }
  scene.updateEnemyProjectiles = function updateProjectiles(dt) { return updateEnemyProjectiles(dt) }
  scene.updateBoss = function updateDungeonBoss(enemy, time, dt, targetPlayer = null) { return updateBoss(enemy, time, dt, targetPlayer) }
  scene.bossCharge = function chargeDungeonBoss(enemy, targetPlayer = null) { return bossCharge(enemy, targetPlayer) }
  scene.bossShockwave = function shockwaveDungeonBoss(enemy) { return bossShockwave(enemy) }
  scene.syncEnemyVisual = function syncDungeonEnemyVisual(enemy, time, targetPlayer = null) { return syncEnemyVisual(enemy, time, targetPlayer) }
  scene.autoAttack = function autoAttackPlayer(time, player = localPlayer) { return autoAttack(time, player) }
  scene.trySkill = function tryPlayerSkill(time, player = localPlayer, input = null) { return trySkill(time, player, input) }
  scene.slash = function slashForPlayer(target, player = localPlayer) { return slash(target, player) }
  scene.healPlayer = function healDungeonPlayer(amount, player = localPlayer) { return healPlayer(amount, player) }
  scene.applyWeaponProcs = function applyPlayerWeaponProcs(primary, damage, critical, player = localPlayer) { return applyWeaponProcs(primary, damage, critical, player) }
  scene.damageEnemy = function damageEnemyForPlayer(enemy, damage, critical, knockback, context, player = localPlayer) { return damageEnemy(enemy, damage, critical, knockback, context, player) }
  scene.killEnemy = function killEnemyForPlayer(enemy, context, player = localPlayer) { return killEnemy(enemy, context, player) }
  scene.updatePortal = function updateSharedPortal(time) { return updatePortal(time) }
  scene.startFloor = startFloor

  const api = {
    localPlayer,
    activePlayers,
    livingPlayers: () => livingPlayers(activePlayers()),
    playerById,
    nearestPlayer,
    setLocalPlayerId(id) { if (id) localPlayer.id = String(id) },
    addPlayer,
    removePlayer,
    readLocalInput,
    normalizeInput: normalizeDungeonInput,
    movePlayer,
    syncAnimation,
    updatePlayerVisual: (player) => updatePlayerVisual(scene, player),
    moveEnemyToward: moveEnemyTowardPlayer,
    updateRangedEnemy,
    updateBoss,
    hitPlayer,
    repositionRemotePlayers,
    restore() {
      for (const player of [...players]) if (!player.local) removePlayer(player.id)
      Object.assign(scene, original)
      scene.localPlayer = null
      scene.__dungeonPlayerRuntime = null
    },
  }

  scene.__dungeonPlayerRuntime = api
  return api
}
