import { rollAffixes } from './affixes.js'
import { chestRewardProfile, nearestInteractable } from './interactables.js'
import { buildNavGrid, findPath, nextWaypoint } from './pathfinding.js'
import { circleHitsSolid, clipSegmentToSolids, movementWithCollision, roomGeometry, terrainAt } from './spatial.js'

const PLAYER_RADIUS = 18
const ENEMY_RADIUS = 15
const PATH_REFRESH_MS = 520
const CHEST_RANGE = 48

const RARITY_DAMAGE = {
  common: [2, 3],
  uncommon: [4, 5],
  rare: [6, 8],
  epic: [9, 12],
}

function clamp01(value) {
  return Math.max(0, Math.min(0.999999, value))
}

function rollRange([min, max], random) {
  return min + Math.floor(clamp01(random()) * (max - min + 1))
}

function rollChestWeapon(profile, floor, random) {
  const roll = clamp01(random())
  let rarity = 'common'
  if (roll < profile.epicChance) rarity = 'epic'
  else if (roll < profile.epicChance + profile.rareChance) rarity = 'rare'
  else if (roll < profile.epicChance + profile.rareChance + profile.uncommonChance) rarity = 'uncommon'
  return {
    type: 'weapon.dungeon_blade',
    rarity,
    damage: rollRange(RARITY_DAMAGE[rarity], random),
    affixes: rollAffixes(floor, rarity, random),
  }
}

function track(scene, object) {
  return scene.trackArena?.(object) ?? object
}

function renderFloor(scene, geometry) {
  const background = track(scene, scene.add.graphics().setDepth(0))
  background.fillStyle(0x080a0d, 1).fillRect(0, 0, geometry.width, geometry.height)
  const tile = 48
  for (let y = 48; y < geometry.height - 48; y += tile) {
    for (let x = 48; x < geometry.width - 48; x += tile) {
      const shade = ((x / tile + y / tile) % 2 === 0) ? 0x171b21 : 0x14181e
      background.fillStyle(shade, 1).fillRect(x, y, tile, tile)
      background.lineStyle(1, 0x252b34, 0.5).strokeRect(x, y, tile, tile)
    }
  }

  for (const water of geometry.water) {
    const body = track(scene, scene.add.rectangle(
      water.x + water.width / 2,
      water.y + water.height / 2,
      water.width,
      water.height,
      0x174c63,
      0.62,
    ).setStrokeStyle(2, 0x3991a9, 0.52).setDepth(2))
    scene.tweens.add({ targets: body, alpha: 0.76, duration: 1200, yoyo: true, repeat: -1 })
    for (let y = water.y + 18; y < water.y + water.height; y += 30) {
      const ripple = track(scene, scene.add.rectangle(water.x + water.width / 2, y, Math.max(30, water.width - 26), 2, 0x69bed0, 0.18).setDepth(3))
      scene.tweens.add({ targets: ripple, x: ripple.x + 9, alpha: 0.34, duration: 900 + (y % 3) * 120, yoyo: true, repeat: -1 })
    }
  }

  for (const solid of geometry.solids) {
    const isBoundary = solid.kind === 'boundary'
    const color = isBoundary ? 0x242a33 : solid.kind === 'pillar' ? 0x313844 : 0x292f39
    const edge = isBoundary ? 0x414b57 : 0x56616f
    track(scene, scene.add.rectangle(
      solid.x + solid.width / 2 + (isBoundary ? 0 : 4),
      solid.y + solid.height / 2 + (isBoundary ? 0 : 6),
      solid.width,
      solid.height,
      0x050607,
      isBoundary ? 0.3 : 0.38,
    ).setDepth(isBoundary ? 3 : 5))
    track(scene, scene.add.rectangle(
      solid.x + solid.width / 2,
      solid.y + solid.height / 2,
      Math.max(2, solid.width - 2),
      Math.max(2, solid.height - 2),
      color,
      0.98,
    ).setStrokeStyle(isBoundary ? 1 : 2, edge, 0.9).setDepth(isBoundary ? 4 : 6))
  }

  for (const torch of geometry.torches) {
    const glow = track(scene, scene.add.circle(torch.x, torch.y, 42, 0xff8a3d, 0.08).setDepth(7))
    const outer = track(scene, scene.add.circle(torch.x, torch.y - 3, 9, 0xff7b35, 0.62).setDepth(8))
    const core = track(scene, scene.add.circle(torch.x, torch.y - 5, 4, 0xffe39a, 0.96).setDepth(9))
    track(scene, scene.add.rectangle(torch.x, torch.y + 10, 5, 18, 0x7e5638, 1).setDepth(7))
    scene.tweens.add({ targets: glow, alpha: 0.2, scale: 1.22, duration: 780 + Math.random() * 220, yoyo: true, repeat: -1 })
    scene.tweens.add({ targets: [outer, core], y: '-=4', scaleX: 0.72, duration: 320 + Math.random() * 120, yoyo: true, repeat: -1 })
  }
}

function renderChest(scene, anchor, index) {
  const x = anchor.x
  const y = anchor.y
  const shadow = track(scene, scene.add.ellipse(x + 4, y + 12, 38, 15, 0x020304, 0.46).setDepth(8))
  const base = track(scene, scene.add.rectangle(x, y + 4, 38, 24, 0x8b542c, 1).setStrokeStyle(2, 0xd5964e, 0.95).setDepth(12))
  const lid = track(scene, scene.add.rectangle(x, y - 9, 40, 14, 0xb36b34, 1).setStrokeStyle(2, 0xf0b35f, 0.95).setDepth(13))
  const lock = track(scene, scene.add.rectangle(x, y + 2, 7, 10, 0xffd86b, 1).setDepth(14))
  const glow = track(scene, scene.add.circle(x, y, 28, 0xffcf68, 0.05).setDepth(10))
  scene.tweens.add({ targets: glow, alpha: 0.14, scale: 1.15, duration: 900, yoyo: true, repeat: -1 })
  return { id: `chest-${index}`, x, y, opened: false, visuals: { shadow, base, lid, lock, glow }, prompt: null }
}

function openChestVisual(scene, chest) {
  chest.opened = true
  chest.visuals.lock?.setVisible(false)
  scene.tweens.add({ targets: chest.visuals.lid, y: chest.y - 23, angle: -8, duration: 160, ease: 'Back.Out' })
  scene.tweens.add({ targets: chest.visuals.glow, alpha: 0.55, scale: 1.7, duration: 220, yoyo: true, onComplete: () => chest.visuals.glow?.setAlpha?.(0.08) })
  scene.__dungeonVfx?.sparkle?.(chest.x, chest.y - 22, { width: 52, height: 52, depth: 28 })
}

function showChestPrompt(scene, chest, label) {
  if (chest?.prompt) return
  chest.prompt = scene.add.text(chest.x, chest.y - 42, `[E] ${label('openChest')}`, {
    fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
    fontSize: '11px',
    fontStyle: 'bold',
    color: '#ffd86b',
    stroke: '#08090b',
    strokeThickness: 4,
  }).setOrigin(0.5).setDepth(36)
}

function hideChestPrompt(chest) {
  chest?.prompt?.destroy?.()
  if (chest) chest.prompt = null
}

function nearestValidSpawn(geometry, position) {
  let best = null
  let distance = Infinity
  for (const spawn of geometry.spawnPoints) {
    if (circleHitsSolid(spawn, ENEMY_RADIUS, geometry)) continue
    const nextDistance = Math.hypot(spawn.x - position.x, spawn.y - position.y)
    if (nextDistance >= distance) continue
    best = spawn
    distance = nextDistance
  }
  return best
}

export function installDungeonSpatial(scene, {
  getProgress = () => ({ floor: scene?.floor ?? 1, chapter: 1, roomRole: 'combat', fortuneActive: false }),
  onEvent = () => {},
  label = (key) => key,
  random = Math.random,
} = {}) {
  if (!scene || scene.__dungeonSpatialInstalled) return scene?.__dungeonSpatial ?? null
  scene.__dungeonSpatialInstalled = true

  let chests = []
  const chestKey = scene.input.keyboard.addKey('E')
  const originalDrawArena = scene.drawArena.bind(scene)
  const originalUpdatePlayer = scene.updatePlayer.bind(scene)
  const originalUpdateRangedEnemy = scene.updateRangedEnemy.bind(scene)
  const originalUpdateEnemyProjectiles = scene.updateEnemyProjectiles.bind(scene)
  const originalUpdateBoss = scene.updateBoss.bind(scene)

  const refreshRoom = () => {
    const progress = getProgress() ?? {}
    const floor = progress.floor ?? scene.floor ?? 1
    const geometry = roomGeometry(null, floor, random)
    scene.clearArena()
    for (const chest of chests) hideChestPrompt(chest)
    chests = []
    renderFloor(scene, geometry)
    scene.__roomGeometry = geometry
    scene.__navGrid = buildNavGrid(geometry, { cellSize: 48, actorRadius: ENEMY_RADIUS })
    scene.spawnPoints = geometry.spawnPoints.map((entry) => [entry.x, entry.y])
    if (progress.roomRole !== 'rest') chests = geometry.chests.slice(0, 1).map((anchor, index) => renderChest(scene, anchor, index))
    scene.__roomChests = chests

    for (const enemy of scene.enemies ?? []) {
      enemy.hitRadius = enemy.boss ? 26 : ENEMY_RADIUS
      if (!circleHitsSolid(enemy, enemy.hitRadius, geometry)) continue
      const spawn = nearestValidSpawn(geometry, enemy)
      if (!spawn) continue
      enemy.x = spawn.x
      enemy.y = spawn.y
      enemy.visual?.setPosition?.(enemy.x, enemy.y)
      enemy.navPath = []
      enemy.navRefreshAt = 0
    }
  }

  scene.drawArena = function drawSpatialArena() {
    originalDrawArena()
    refreshRoom()
  }

  scene.updatePlayer = function updateSpatialPlayer(dt) {
    const before = { x: scene.playerState.x, y: scene.playerState.y }
    if ((scene.__hitStopUntil ?? 0) > scene.time.now) {
      scene.playerMoving = false
      if (!scene.playerAttacking) scene.syncPlayerAnimation?.()
      return
    }
    originalUpdatePlayer(dt)
    const desired = { x: scene.playerState.x, y: scene.playerState.y }
    const terrain = terrainAt(before, scene.__roomGeometry)
    const delta = {
      x: (desired.x - before.x) * terrain.speedMultiplier,
      y: (desired.y - before.y) * terrain.speedMultiplier,
    }
    const next = movementWithCollision(before, delta, PLAYER_RADIUS, scene.__roomGeometry)
    scene.playerState.x = next.x
    scene.playerState.y = next.y
    scene.player?.setPosition?.(next.x, next.y)
    scene.updateHealthBar?.(scene.playerBar, next.x, next.y - 42, scene.playerState.hp, scene.playerState.maxHp)
  }

  function navigateEnemy(enemy, target, time, dt) {
    const geometry = scene.__roomGeometry
    if (!geometry || (scene.__hitStopUntil ?? 0) > time) return
    const terrain = terrainAt(enemy, geometry)
    const directEnd = clipSegmentToSolids(enemy, target, geometry, 3)
    let destination = target
    if (directEnd.blocked) {
      const needsRefresh = !enemy.navPath?.length || time >= (enemy.navRefreshAt ?? 0)
      if (needsRefresh) {
        enemy.navPath = findPath(scene.__navGrid, enemy, target)
        enemy.navRefreshAt = time + PATH_REFRESH_MS + ((enemy.id?.length ?? 0) % 7) * 37
      }
      destination = nextWaypoint(enemy.navPath, enemy, 20) ?? target
    } else {
      enemy.navPath = []
    }
    const dx = destination.x - enemy.x
    const dy = destination.y - enemy.y
    const distance = Math.hypot(dx, dy) || 1
    const speed = enemy.speed * terrain.speedMultiplier
    const next = movementWithCollision(enemy, { x: (dx / distance) * speed * dt, y: (dy / distance) * speed * dt }, enemy.hitRadius ?? ENEMY_RADIUS, geometry)
    enemy.x = next.x
    enemy.y = next.y
  }

  scene.moveEnemyTowardPlayer = function moveSpatialEnemy(enemy, time, dt) {
    navigateEnemy(enemy, scene.playerState, time, dt)
    const dx = scene.playerState.x - enemy.x
    const dy = scene.playerState.y - enemy.y
    const distance = Math.hypot(dx, dy) || 1
    scene.syncEnemyVisual(enemy, time, dx, distance)
  }

  scene.updateRangedEnemy = function updateSpatialRanged(enemy, time, dt) {
    if ((scene.__hitStopUntil ?? 0) > time) return
    const dx = scene.playerState.x - enemy.x
    const dy = scene.playerState.y - enemy.y
    const distance = Math.hypot(dx, dy) || 1
    const preferred = enemy.preferredRange || 180
    const los = clipSegmentToSolids(enemy, scene.playerState, scene.__roomGeometry, 3)

    if (distance > enemy.attackRange || los.blocked) {
      navigateEnemy(enemy, scene.playerState, time, dt)
    } else if (distance < preferred - 34) {
      const next = movementWithCollision(enemy, {
        x: -(dx / distance) * enemy.speed * 0.72 * dt,
        y: -(dy / distance) * enemy.speed * 0.72 * dt,
      }, enemy.hitRadius ?? ENEMY_RADIUS, scene.__roomGeometry)
      enemy.x = next.x
      enemy.y = next.y
    } else {
      const strafe = Math.sin((time + enemy.x * 7) / 650) * enemy.speed * 0.28 * dt
      const next = movementWithCollision(enemy, {
        x: (-dy / distance) * strafe,
        y: (dx / distance) * strafe,
      }, enemy.hitRadius ?? ENEMY_RADIUS, scene.__roomGeometry)
      enemy.x = next.x
      enemy.y = next.y
    }

    const nextDx = scene.playerState.x - enemy.x
    const nextDy = scene.playerState.y - enemy.y
    const nextDistance = Math.hypot(nextDx, nextDy) || 1
    scene.syncEnemyVisual(enemy, time, nextDx, nextDistance)
    const clearShot = !clipSegmentToSolids(enemy, scene.playerState, scene.__roomGeometry, 3).blocked
    if (clearShot && nextDistance <= enemy.attackRange && time >= enemy.nextProjectileAt) {
      enemy.nextProjectileAt = time + enemy.projectileCooldown
      scene.fireEnemyProjectile(enemy)
    }
  }

  scene.updateEnemyProjectiles = function updateSpatialProjectiles(dt) {
    if ((scene.__hitStopUntil ?? 0) > scene.time.now) return
    for (let index = scene.enemyProjectiles.length - 1; index >= 0; index--) {
      const projectile = scene.enemyProjectiles[index]
      const next = { x: projectile.x + projectile.vx * dt, y: projectile.y + projectile.vy * dt }
      projectile.life -= dt
      const wallHit = circleHitsSolid(next, 5, scene.__roomGeometry)
      if (!wallHit) {
        projectile.x = next.x
        projectile.y = next.y
        projectile.visual?.setPosition(projectile.x, projectile.y)
        projectile.glow?.setPosition(projectile.x, projectile.y)
      }
      const playerHit = !wallHit && Math.hypot(projectile.x - scene.playerState.x, projectile.y - scene.playerState.y) <= 20
      const expired = projectile.life <= 0
      if (!wallHit && !playerHit && !expired) continue
      if (playerHit) scene.hitPlayer(projectile.damage)
      projectile.visual?.destroy()
      projectile.glow?.destroy()
      scene.enemyProjectiles.splice(index, 1)
    }
  }

  scene.updateBoss = function updateSpatialBoss(enemy, time, dt) {
    const before = { x: enemy.x, y: enemy.y }
    originalUpdateBoss(enemy, time, dt)
    if (!scene.__roomGeometry) return
    const moved = { x: enemy.x - before.x, y: enemy.y - before.y }
    const corrected = movementWithCollision(before, moved, enemy.hitRadius ?? 26, scene.__roomGeometry)
    const blocked = corrected.x !== enemy.x || corrected.y !== enemy.y
    enemy.x = corrected.x
    enemy.y = corrected.y
    if (blocked && time < enemy.chargingUntil) enemy.chargingUntil = time
    enemy.visual?.setPosition?.(enemy.x, enemy.y)
  }

  const updateInteraction = () => {
    const nearest = nearestInteractable(scene.playerState, chests, CHEST_RANGE)
    for (const chest of chests) {
      if (chest === nearest) showChestPrompt(scene, chest, label)
      else hideChestPrompt(chest)
    }
  }
  scene.events.on('update', updateInteraction)

  const openNearestChest = () => {
    const chest = nearestInteractable(scene.playerState, chests, CHEST_RANGE)
    if (!chest) return
    openChestVisual(scene, chest)
    hideChestPrompt(chest)
    const progress = getProgress() ?? {}
    const profile = chestRewardProfile(progress.roomRole ?? 'combat', progress.chapter ?? 1, Boolean(progress.fortuneActive))
    const floor = progress.floor ?? scene.floor ?? 1
    onEvent({ type: 'chestopen', floor, chapter: progress.chapter ?? 1, roomRole: progress.roomRole ?? 'combat' })
    scene.time.delayedCall(90, () => {
      for (let index = 0; index < profile.dropCount; index++) {
        const item = rollChestWeapon(profile, floor, random)
        scene.spawnDrop(chest.x + (index - (profile.dropCount - 1) / 2) * 28, chest.y + 18, item)
      }
    })
  }
  chestKey.on('down', openNearestChest)

  refreshRoom()

  scene.events.once('shutdown', () => {
    chestKey.off('down', openNearestChest)
    scene.events.off('update', updateInteraction)
    for (const chest of chests) hideChestPrompt(chest)
    scene.updatePlayer = originalUpdatePlayer
    scene.updateRangedEnemy = originalUpdateRangedEnemy
    scene.updateEnemyProjectiles = originalUpdateEnemyProjectiles
    scene.updateBoss = originalUpdateBoss
  })

  const api = { refreshRoom, getGeometry: () => scene.__roomGeometry, getChests: () => [...chests] }
  scene.__dungeonSpatial = api
  return api
}
