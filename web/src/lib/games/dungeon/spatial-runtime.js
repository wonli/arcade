import { rollAffixes } from './affixes.js'
import { chooseEnvironmentAssets } from './environment-assets.js'
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

function normalizedAssets(manifest = {}) {
  return Array.isArray(manifest.assets) ? manifest.assets : []
}

function chooseEnvironmentAsset(assets, patterns) {
  for (const pattern of patterns) {
    const found = assets.find((asset) => asset?.path && pattern.test(asset.path) && (asset.frames ?? 1) === 1)
    if (found) return found
  }
  return null
}

export function selectDebtsEnvironmentAssets(manifest = {}) {
  const assets = normalizedAssets(manifest).filter((asset) => !asset.source || asset.source === 'debts')
  return {
    obstacle: chooseEnvironmentAsset(assets, [
      /(?:pillar|column|statue)/i,
      /(?:crate|barrel|rock|boulder)/i,
      /(?:bones|skull|grave|tomb)/i,
    ]),
    torch: chooseEnvironmentAsset(assets, [/(?:torch|brazier)/i, /(?:candle|lantern)/i, /(?:fire|flame)/i]),
    chest: chooseEnvironmentAsset(assets, [/(?:chest|coffer)/i, /(?:treasure|loot)/i]),
  }
}

export function spatialTextureKey(kind, available = {}) {
  if (kind === 'floor') return available.tilesetFloor ? 'dungeon-tileset-floor' : available.floor ? 'dungeon-floor' : null
  if (kind === 'boundary' || kind === 'wall') return available.tilesetWall ? 'dungeon-tileset-wall' : available.wall ? 'dungeon-wall' : null
  if (kind === 'water') return available.tilesetWater ? 'dungeon-tileset-water' : null
  if (kind === 'water-detail') return available.tilesetWaterDetail ? 'dungeon-tileset-water-detail' : null
  if (kind === 'pillar' || kind === 'broken-wall' || kind === 'pillar-wall') return available.tilesetObstacle ? 'dungeon-tileset-obstacle' : available.obstacle ? 'dungeon-obstacle' : null
  if (kind === 'torch') return available.tilesetTorch ? 'dungeon-tileset-torch' : available.torch ? 'dungeon-torch' : null
  if (kind === 'chest') return available.tilesetChest ? 'dungeon-tileset-chest' : available.chest ? 'dungeon-chest' : null
  return null
}

export function spatialTextureFrame(kind, frames = {}) {
  if (kind === 'boundary' || kind === 'wall') return frames.wall ?? null
  if (kind === 'pillar' || kind === 'broken-wall' || kind === 'pillar-wall') return frames.obstacle ?? null
  return frames[kind] ?? null
}

export function spatialTileStack(kind, stacks = {}) {
  if (kind !== 'pillar') return null
  return Array.isArray(stacks.obstacle) && stacks.obstacle.length ? stacks.obstacle : null
}

export function spatialAnimation(kind, animations = {}) {
  if (kind !== 'water-detail') return null
  return Array.isArray(animations.waterDetail) && animations.waterDetail.length ? animations.waterDetail : null
}

export function spatialSurfaceTint(kind) {
  if (kind === 'floor') return 0xb49a82
  if (kind === 'boundary' || kind === 'wall') return 0x667488
  if (kind === 'water') return 0x7db5c8
  return 0xaeb5bd
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

function textureAvailability(scene) {
  const exists = (key) => Boolean(scene.textures?.exists?.(key))
  return {
    tilesetFloor: exists('dungeon-tileset-floor'),
    tilesetWall: exists('dungeon-tileset-wall'),
    tilesetWater: exists('dungeon-tileset-water'),
    tilesetWaterDetail: exists('dungeon-tileset-water-detail'),
    tilesetObstacle: exists('dungeon-tileset-obstacle'),
    tilesetTorch: exists('dungeon-tileset-torch'),
    tilesetChest: exists('dungeon-tileset-chest'),
    floor: exists('dungeon-floor'),
    wall: exists('dungeon-wall'),
    obstacle: exists('dungeon-obstacle'),
    torch: exists('dungeon-torch'),
    chest: exists('dungeon-chest'),
  }
}

function addTiledTexture(scene, x, y, width, height, key, depth, tint = null, frame = null) {
  const tile = track(scene, scene.add.tileSprite(x, y, Math.max(1, width), Math.max(1, height), key, frame ?? undefined).setDepth(depth))
  if (tint != null) tile.setTint?.(tint)
  return tile
}

function animateTiledTexture(scene, target, frames) {
  if (!target || !Array.isArray(frames) || frames.length < 2 || !scene.time?.delayedCall) return target
  let index = 0
  const advance = () => {
    if (target.active === false) return
    const frame = frames[index % frames.length]
    target.setFrame?.(frame.tileId)
    index = (index + 1) % frames.length
    scene.time.delayedCall(Math.max(16, Number(frame.duration) || 150), advance)
  }
  advance()
  return target
}

function addScaledImage(scene, x, y, key, targetHeight, depth, frame = null) {
  const image = track(scene, scene.add.image(x, y, key, frame ?? undefined).setDepth(depth))
  const sourceHeight = image.height || targetHeight
  image.setScale?.(targetHeight / Math.max(1, sourceHeight))
  return image
}

function addStackedTileProp(scene, x, bottomY, key, tileFrames, targetHeight, depth) {
  if (!Array.isArray(tileFrames) || !tileFrames.length) return []
  const targetTileHeight = targetHeight / tileFrames.length
  const sprites = []
  for (let index = 0; index < tileFrames.length; index++) {
    const frame = tileFrames[index]
    const y = bottomY - targetHeight + targetTileHeight * (index + 0.5)
    const sprite = track(scene, scene.add.image(x, y, key, frame).setDepth(depth))
    const sourceHeight = sprite.height || 16
    sprite.setScale?.(targetTileHeight / Math.max(1, sourceHeight))
    sprites.push(sprite)
  }
  return sprites
}

function renderFloor(scene, geometry) {
  const background = track(scene, scene.add.graphics().setDepth(0))
  background.fillStyle(0x080a0d, 1).fillRect(0, 0, geometry.width, geometry.height)
  const tile = 48
  const available = textureAvailability(scene)
  const frames = scene.__dungeonEnvironmentFrames ?? {}
  const stacks = scene.__dungeonEnvironmentStacks ?? {}
  const animations = scene.__dungeonEnvironmentAnimations ?? {}
  const floorTexture = spatialTextureKey('floor', available)

  if (floorTexture) {
    addTiledTexture(
      scene,
      geometry.width / 2,
      geometry.height / 2,
      geometry.width - tile * 2,
      geometry.height - tile * 2,
      floorTexture,
      1,
      spatialSurfaceTint('floor'),
      spatialTextureFrame('floor', frames),
    )
  } else {
    for (let y = tile; y < geometry.height - tile; y += tile) {
      for (let x = tile; x < geometry.width - tile; x += tile) {
        const shade = ((x / tile + y / tile) % 2 === 0) ? 0x2a241f : 0x25201c
        background.fillStyle(shade, 1).fillRect(x, y, tile, tile)
        background.lineStyle(1, 0x3a312a, 0.55).strokeRect(x, y, tile, tile)
      }
    }
  }

  for (const water of geometry.water) {
    const waterTexture = spatialTextureKey('water', available)
    let body
    if (waterTexture) {
      body = addTiledTexture(
        scene,
        water.x + water.width / 2,
        water.y + water.height / 2,
        water.width,
        water.height,
        waterTexture,
        2,
        spatialSurfaceTint('water'),
        spatialTextureFrame('water', frames),
      )
      body.setAlpha?.(0.9)
    } else {
      body = track(scene, scene.add.rectangle(
        water.x + water.width / 2,
        water.y + water.height / 2,
        water.width,
        water.height,
        0x174c63,
        0.62,
      ).setStrokeStyle(2, 0x3991a9, 0.52).setDepth(2))
    }

    const detailTexture = spatialTextureKey('water-detail', available)
    const detailAnimation = spatialAnimation('water-detail', animations)
    if (detailTexture && detailAnimation) {
      const detail = addTiledTexture(
        scene,
        water.x + water.width / 2,
        water.y + water.height / 2,
        water.width,
        water.height,
        detailTexture,
        3,
        null,
        detailAnimation[0]?.tileId,
      )
      detail.setAlpha?.(0.58)
      animateTiledTexture(scene, detail, detailAnimation)
    }

    scene.tweens.add({ targets: body, alpha: 0.76, duration: 1200, yoyo: true, repeat: -1 })
    for (let y = water.y + 18; y < water.y + water.height; y += 30) {
      const ripple = track(scene, scene.add.rectangle(water.x + water.width / 2, y, Math.max(30, water.width - 26), 2, 0x69bed0, 0.18).setDepth(4))
      scene.tweens.add({ targets: ripple, x: ripple.x + 9, alpha: 0.34, duration: 900 + (y % 3) * 120, yoyo: true, repeat: -1 })
    }
  }

  for (const solid of geometry.solids) {
    const isBoundary = solid.kind === 'boundary'
    const texture = spatialTextureKey(solid.kind, available)
    const depth = isBoundary ? 4 : 6
    track(scene, scene.add.rectangle(
      solid.x + solid.width / 2 + (isBoundary ? 0 : 4),
      solid.y + solid.height / 2 + (isBoundary ? 0 : 6),
      solid.width,
      solid.height,
      0x050607,
      isBoundary ? 0.34 : 0.42,
    ).setDepth(depth - 1))

    if (texture) {
      const tileStack = spatialTileStack(solid.kind, stacks)
      if (tileStack) {
        addStackedTileProp(
          scene,
          solid.x + solid.width / 2,
          solid.y + solid.height / 2 + 10,
          texture,
          tileStack,
          Math.max(64, solid.height + 24),
          depth,
        )
        continue
      }
      addTiledTexture(
        scene,
        solid.x + solid.width / 2,
        solid.y + solid.height / 2,
        Math.max(2, solid.width - 2),
        Math.max(2, solid.height - 2),
        texture,
        depth,
        spatialSurfaceTint(solid.kind),
        spatialTextureFrame(solid.kind, frames),
      )
      continue
    }

    const color = isBoundary ? 0x303b49 : solid.kind === 'pillar' ? 0x555d66 : 0x48515c
    const edge = isBoundary ? 0x708095 : 0x8b949f
    track(scene, scene.add.rectangle(
      solid.x + solid.width / 2,
      solid.y + solid.height / 2,
      Math.max(2, solid.width - 2),
      Math.max(2, solid.height - 2),
      color,
      0.98,
    ).setStrokeStyle(isBoundary ? 1 : 2, edge, 0.9).setDepth(depth))
  }

  for (const torch of geometry.torches) {
    const glow = track(scene, scene.add.circle(torch.x, torch.y, 42, 0xff8a3d, 0.08).setDepth(7))
    const torchTexture = spatialTextureKey('torch', available)
    if (torchTexture) {
      const sprite = addScaledImage(scene, torch.x, torch.y + 2, torchTexture, 34, 9, spatialTextureFrame('torch', frames))
      scene.tweens.add({ targets: glow, alpha: 0.2, scale: 1.22, duration: 780 + Math.random() * 220, yoyo: true, repeat: -1 })
      scene.tweens.add({ targets: sprite, y: sprite.y - 1, duration: 460 + Math.random() * 120, yoyo: true, repeat: -1 })
      continue
    }
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
  const available = textureAvailability(scene)
  const frames = scene.__dungeonEnvironmentFrames ?? {}
  const shadow = track(scene, scene.add.ellipse(x + 4, y + 12, 38, 15, 0x020304, 0.46).setDepth(8))
  const glow = track(scene, scene.add.circle(x, y, 28, 0xffcf68, 0.05).setDepth(10))
  const chestTexture = spatialTextureKey('chest', available)
  let sprite = null
  let base = null
  let lid = null
  let lock = null
  if (chestTexture) {
    sprite = addScaledImage(scene, x, y, chestTexture, 34, 13, spatialTextureFrame('chest', frames))
  } else {
    base = track(scene, scene.add.rectangle(x, y + 4, 38, 24, 0x8b542c, 1).setStrokeStyle(2, 0xd5964e, 0.95).setDepth(12))
    lid = track(scene, scene.add.rectangle(x, y - 9, 40, 14, 0xb36b34, 1).setStrokeStyle(2, 0xf0b35f, 0.95).setDepth(13))
    lock = track(scene, scene.add.rectangle(x, y + 2, 7, 10, 0xffd86b, 1).setDepth(14))
  }
  scene.tweens.add({ targets: glow, alpha: 0.14, scale: 1.15, duration: 900, yoyo: true, repeat: -1 })
  return { id: `chest-${index}`, x, y, opened: false, visuals: { shadow, sprite, base, lid, lock, glow }, prompt: null }
}

function openChestVisual(scene, chest) {
  chest.opened = true
  chest.visuals.lock?.setVisible(false)
  if (chest.visuals.sprite) {
    scene.tweens.add({ targets: chest.visuals.sprite, y: chest.y - 5, angle: -4, duration: 160, ease: 'Back.Out' })
  } else {
    scene.tweens.add({ targets: chest.visuals.lid, y: chest.y - 23, angle: -8, duration: 160, ease: 'Back.Out' })
  }
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

function queueEnvironmentTexture(scene, key, asset) {
  if (!asset?.path || scene.textures?.exists?.(key)) return false
  if ((asset.frames ?? 1) > 1 && asset.frameWidth > 0 && asset.frameHeight > 0) {
    scene.load.spritesheet(key, asset.path, {
      frameWidth: asset.frameWidth,
      frameHeight: asset.frameHeight,
      endFrame: asset.frames - 1,
    })
  } else {
    scene.load.image(key, asset.path)
  }
  return true
}

async function loadEnvironmentTextures(scene) {
  if (typeof fetch !== 'function' || scene.__environmentLoadStarted) return false
  scene.__environmentLoadStarted = true
  try {
    const response = await fetch('/assets/debts/manifest.json')
    if (!response.ok) return false
    const manifest = await response.json()
    const selected = chooseEnvironmentAssets(manifest)
    const complete = selected.floor && selected.wall && selected.water && selected.obstacle && selected.torch && selected.chest

    if (complete) {
      scene.__dungeonEnvironmentFrames = Object.fromEntries(
        Object.entries(selected).map(([kind, asset]) => [kind, asset?.frame ?? 0]),
      )
      scene.__dungeonEnvironmentStacks = Object.fromEntries(
        Object.entries(selected)
          .filter(([, asset]) => Array.isArray(asset?.tileStack) && asset.tileStack.length)
          .map(([kind, asset]) => [kind, [...asset.tileStack]]),
      )
      scene.__dungeonEnvironmentAnimations = Object.fromEntries(
        Object.entries(selected)
          .filter(([, asset]) => Array.isArray(asset?.animation) && asset.animation.length)
          .map(([kind, asset]) => [kind, asset.animation.map((entry) => ({ ...entry }))]),
      )
      const queue = [
        ['dungeon-tileset-floor', selected.floor],
        ['dungeon-tileset-wall', selected.wall],
        ['dungeon-tileset-water', selected.water],
        ['dungeon-tileset-water-detail', selected.waterDetail],
        ['dungeon-tileset-obstacle', selected.obstacle],
        ['dungeon-tileset-torch', selected.torch],
        ['dungeon-tileset-chest', selected.chest],
      ]
      const queued = queue.map(([key, asset]) => queueEnvironmentTexture(scene, key, asset)).some(Boolean)
      if (!queued) return true
      await new Promise((resolve) => {
        scene.load.once('complete', resolve)
        scene.load.start()
      })
      return true
    }

    const fallback = selectDebtsEnvironmentAssets(manifest)
    const queue = [
      ['dungeon-obstacle', fallback.obstacle],
      ['dungeon-torch', fallback.torch],
      ['dungeon-chest', fallback.chest],
    ]
    const queued = queue.map(([key, asset]) => queueEnvironmentTexture(scene, key, asset)).some(Boolean)
    if (!queued) return false
    await new Promise((resolve) => {
      scene.load.once('complete', resolve)
      scene.load.start()
    })
    return true
  } catch {
    return false
  }
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

  const refreshRoom = ({ geometry: fixedGeometry = null } = {}) => {
    const progress = getProgress() ?? {}
    const floor = progress.floor ?? scene.floor ?? 1
    const geometry = fixedGeometry ?? roomGeometry(null, floor, random)
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
    scene.drawArena = originalDrawArena
    scene.updatePlayer = originalUpdatePlayer
    scene.updateRangedEnemy = originalUpdateRangedEnemy
    scene.updateEnemyProjectiles = originalUpdateEnemyProjectiles
    scene.updateBoss = originalUpdateBoss
  })

  const api = { refreshRoom, getGeometry: () => scene.__roomGeometry, getChests: () => [...chests] }
  scene.__dungeonSpatial = api
  loadEnvironmentTextures(scene).then((loaded) => {
    if (!loaded || !scene.__roomGeometry) return
    refreshRoom({ geometry: scene.__roomGeometry })
  })
  return api
}
