import { activeTrapAt } from './dungeon3-hazards.js'
import { queueDungeon3Textures, renderDungeon3Terrain } from './dungeon3-renderer.js'
import { placePlayerAtRoomSpawn, safeEnemySpawn } from './room-anchors.js'
import { rollAffixes } from './affixes.js'
import { chooseEnvironmentAssets } from './environment-assets.js'
import { chestRewardProfile, nearestInteractable } from './interactables.js'
import { buildNavGrid, findPath, nextWaypoint } from './pathfinding.js'
import { circleHitsSolid, clipSegmentToSolids, movementWithCollision, roomGeometry } from './spatial.js'

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
    obstacle: chooseEnvironmentAsset(assets, [/(?:pillar|column|statue)/i, /(?:crate|barrel|rock|boulder)/i, /(?:bones|skull|grave|tomb)/i]),
    torch: chooseEnvironmentAsset(assets, [/(?:torch|brazier)/i, /(?:candle|lantern)/i, /(?:fire|flame)/i]),
    chest: chooseEnvironmentAsset(assets, [/(?:chest|coffer)/i, /(?:treasure|loot)/i]),
  }
}

export function spatialTextureKey(kind, available = {}) {
  if (kind === 'floor') return available.tilesetFloor ? 'dungeon-tileset-floor' : available.floor ? 'dungeon-floor' : null
  if (kind === 'floor-decoration' || kind === 'path-plate') return available.tilesetFloorDecoration ? 'dungeon-tileset-floor-decoration' : null
  if (kind === 'bridge') return available.tilesetBridge ? 'dungeon-tileset-bridge' : available.tilesetFloorDecoration ? 'dungeon-tileset-floor-decoration' : null
  if (kind === 'stairs') return available.tilesetStairs ? 'dungeon-tileset-stairs' : null
  if (kind === 'door') return available.tilesetDoor ? 'dungeon-tileset-door' : null
  if (kind === 'statue') return available.tilesetStatue ? 'dungeon-tileset-statue' : null
  if (kind === 'coffin') return available.tilesetCoffin ? 'dungeon-tileset-coffin' : null
  if (kind === 'object' || kind === 'plate') return available.tilesetObject ? 'dungeon-tileset-object' : available.tilesetFloorDecoration ? 'dungeon-tileset-floor-decoration' : null
  if (kind === 'plate-trap') return available.tilesetTrapPlate ? 'dungeon-tileset-trap-plate' : null
  if (kind === 'spikes') return available.tilesetTrapSpikes ? 'dungeon-tileset-trap-spikes' : null
  if (kind === 'candles') return available.tilesetCandles ? 'dungeon-tileset-candles' : null
  if (kind === 'arches') return available.tilesetArches ? 'dungeon-tileset-arches' : available.tilesetObstacle ? 'dungeon-tileset-obstacle' : null
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
  if (kind === 'water-detail') return Array.isArray(animations.waterDetail) && animations.waterDetail.length ? animations.waterDetail : null
  if (kind === 'chest') return Array.isArray(animations.chest) && animations.chest.length ? animations.chest : null
  return null
}

export function spatialSurfaceTint(kind) {
  if (kind === 'floor' || kind === 'water' || kind === 'bridge' || kind === 'stairs' || kind === 'door' || kind === 'statue' || kind === 'coffin' || kind === 'object' || kind === 'plate' || kind === 'plate-trap' || kind === 'spikes' || kind === 'arches') return null
  if (kind === 'boundary' || kind === 'wall') return 0x667488
  return 0xaeb5bd
}

function clamp01(value) { return Math.max(0, Math.min(0.999999, value)) }
function rollRange([min, max], random) { return min + Math.floor(clamp01(random()) * (max - min + 1)) }

function rollChestWeapon(profile, floor, random) {
  const roll = clamp01(random())
  let rarity = 'common'
  if (roll < profile.epicChance) rarity = 'epic'
  else if (roll < profile.epicChance + profile.rareChance) rarity = 'rare'
  else if (roll < profile.epicChance + profile.rareChance + profile.uncommonChance) rarity = 'uncommon'
  return { type: 'weapon.dungeon_blade', rarity, damage: rollRange(RARITY_DAMAGE[rarity], random), affixes: rollAffixes(floor, rarity, random) }
}

function track(scene, object) { return scene.trackArena?.(object) ?? object }

function textureAvailability(scene) {
  const exists = (key) => Boolean(scene.textures?.exists?.(key))
  return {
    tilesetFloor: exists('dungeon-tileset-floor'), tilesetFloorDecoration: exists('dungeon-tileset-floor-decoration'), tilesetWall: exists('dungeon-tileset-wall'),
    tilesetWater: exists('dungeon-tileset-water'), tilesetWaterDetail: exists('dungeon-tileset-water-detail'), tilesetObstacle: exists('dungeon-tileset-obstacle'),
    tilesetTorch: exists('dungeon-tileset-torch'), tilesetChest: exists('dungeon-tileset-chest'), tilesetBridge: exists('dungeon-tileset-bridge'),
    tilesetStairs: exists('dungeon-tileset-stairs'), tilesetDoor: exists('dungeon-tileset-door'), tilesetStatue: exists('dungeon-tileset-statue'),
    tilesetCoffin: exists('dungeon-tileset-coffin'), tilesetObject: exists('dungeon-tileset-object'), tilesetTrapPlate: exists('dungeon-tileset-trap-plate'),
    tilesetTrapSpikes: exists('dungeon-tileset-trap-spikes'), tilesetCandles: exists('dungeon-tileset-candles'), tilesetArches: exists('dungeon-tileset-arches'),
    floor: exists('dungeon-floor'), wall: exists('dungeon-wall'), obstacle: exists('dungeon-obstacle'), torch: exists('dungeon-torch'), chest: exists('dungeon-chest'),
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

function animateOnce(scene, target, frames, terminalFrame = null) {
  if (!target || !Array.isArray(frames) || !frames.length || !scene.time?.delayedCall) {
    if (terminalFrame != null) target?.setFrame?.(terminalFrame)
    return
  }
  let index = 0
  const advance = () => {
    if (target.active === false) return
    if (index >= frames.length) { target.setFrame?.(terminalFrame ?? frames.at(-1)?.tileId); return }
    const frame = frames[index++]
    target.setFrame?.(frame.tileId)
    scene.time.delayedCall(Math.max(16, Number(frame.duration) || 120), advance)
  }
  advance()
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

function frameFromSet(scene, role, index = 0) {
  const frames = scene.__dungeonEnvironmentFrameSets?.[role]
  if (!Array.isArray(frames) || !frames.length) return scene.__dungeonEnvironmentFrames?.[role] ?? 0
  return frames[Math.abs(index) % frames.length]
}

function renderAuthoredFloorSkin(scene, geometry, floorTexture, frame, skin) {
  const inset = 48, left = inset, top = inset, right = geometry.width - inset, bottom = geometry.height - inset
  const width = right - left, height = bottom - top
  addTiledTexture(scene, left + width / 2, top + height / 2, width, height, floorTexture, 1, null, frame)
  const edge = skin?.autotile
  if (edge) {
    const size = 16
    addTiledTexture(scene, left + width / 2, top + size / 2, width - size * 2, size, floorTexture, 1.2, null, edge.top)
    addTiledTexture(scene, left + width / 2, bottom - size / 2, width - size * 2, size, floorTexture, 1.2, null, edge.bottom)
    addTiledTexture(scene, left + size / 2, top + height / 2, size, height - size * 2, floorTexture, 1.2, null, edge.left)
    addTiledTexture(scene, right - size / 2, top + height / 2, size, height - size * 2, floorTexture, 1.2, null, edge.right)
    addScaledImage(scene, left + size / 2, top + size / 2, floorTexture, size, 1.21, edge.topLeft)
    addScaledImage(scene, right - size / 2, top + size / 2, floorTexture, size, 1.21, edge.topRight)
    addScaledImage(scene, left + size / 2, bottom - size / 2, floorTexture, size, 1.21, edge.bottomLeft)
    addScaledImage(scene, right - size / 2, bottom - size / 2, floorTexture, size, 1.21, edge.bottomRight)
  }
  const detailFrames = Array.isArray(skin?.detailFrames) ? skin.detailFrames : []
  if (!detailFrames.length) return
  const step = 88
  let row = 0
  for (let y = top + 48; y < bottom - 36; y += step, row++) {
    let column = 0
    for (let x = left + 48; x < right - 36; x += step, column++) {
      const seed = row * 17 + column * 31 + (geometry.seed ?? 0)
      if (Math.abs(seed) % 4 !== 0) continue
      const detail = addScaledImage(scene, x + ((seed % 3) - 1) * 8, y + (((seed >> 1) % 3) - 1) * 7, floorTexture, 16, 1.3, detailFrames[Math.abs(seed) % detailFrames.length])
      detail.setAlpha?.(0.74)
    }
  }
}

function renderFloorDecorations(scene, geometry, available) {
  const texture = spatialTextureKey('floor-decoration', available)
  const frames = scene.__dungeonEnvironmentDecorationFrames ?? []
  if (!texture || !frames.length) return
  const anchors = geometry.decorations?.length ? geometry.decorations.filter((entry) => entry.kind === 'plate').map((entry) => [entry.x, entry.y]) : [[180,132],[326,204],[642,144],[748,360],[266,410],[604,432]]
  for (let index = 0; index < Math.min(8, anchors.length); index++) {
    const [x, y] = anchors[index]
    if (circleHitsSolid({ x, y }, 16, geometry)) continue
    const sprite = addScaledImage(scene, x, y, texture, 20 + (index % 3) * 2, 1.42, frames[index % frames.length])
    sprite.setAlpha?.(0.84)
  }
}

function coastMask(column, row, columns, rows) {
  return `${row > 0 ? 1 : 0}${column < columns - 1 ? 1 : 0}${row < rows - 1 ? 1 : 0}${column > 0 ? 1 : 0}`
}

function coastFramesFor(scene, mask) {
  return scene.__dungeonEnvironmentWaterCoasts?.patterns?.[mask] ?? []
}

function renderAuthoredWater(scene, geometry, water, waterIndex, available, frames, animations) {
  const waterTexture = spatialTextureKey('water', available)
  if (!waterTexture) {
    return track(scene, scene.add.rectangle(water.x + water.width / 2, water.y + water.height / 2, water.width, water.height, 0x174c63, 0.88).setDepth(2))
  }

  const baseFrame = spatialTextureFrame('water', frames)
  const body = addTiledTexture(scene, water.x + water.width / 2, water.y + water.height / 2, water.width, water.height, waterTexture, 2, null, baseFrame)
  body.setAlpha?.(1)

  const coasts = scene.__dungeonEnvironmentWaterCoasts
  const tileSize = Math.max(8, Number(coasts?.tileSize) || 16)
  if (coasts?.patterns) {
    const columns = Math.max(1, Math.ceil(water.width / tileSize))
    const rows = Math.max(1, Math.ceil(water.height / tileSize))
    for (let row = 0; row < rows; row++) {
      for (let column = 0; column < columns; column++) {
        if (row > 0 && row < rows - 1 && column > 0 && column < columns - 1) continue
        const mask = coastMask(column, row, columns, rows)
        const variants = coastFramesFor(scene, mask)
        if (!variants.length) continue
        const seed = Math.abs((geometry.seed ?? 0) + waterIndex * 97 + row * 31 + column * 17)
        const frame = variants[seed % variants.length]
        const x = water.x + column * tileSize + tileSize / 2
        const y = water.y + row * tileSize + tileSize / 2
        const coast = addScaledImage(scene, x, y, waterTexture, tileSize, 3.2, frame)
        const animation = coasts.animations?.[String(frame)]
        if (Array.isArray(animation) && animation.length > 1) animateTiledTexture(scene, coast, animation)
      }
    }
  }

  const detailTexture = spatialTextureKey('water-detail', available)
  const detailAnimation = spatialAnimation('water-detail', animations)
  if (detailTexture && detailAnimation) {
    const inset = tileSize
    const width = Math.max(tileSize, water.width - inset * 2)
    const height = Math.max(tileSize, water.height - inset * 2)
    if (width > tileSize && height > tileSize) {
      const detail = addTiledTexture(scene, water.x + water.width / 2, water.y + water.height / 2, width, height, detailTexture, 2.7, null, detailAnimation[0]?.tileId)
      detail.setAlpha?.(0.48)
      animateTiledTexture(scene, detail, detailAnimation)
    }
  }
  return body
}

function renderBridge(scene, bridge, available, index) {
  const texture = spatialTextureKey('bridge', available)
  const horizontal = bridge.width >= bridge.height
  track(scene, scene.add.rectangle(bridge.x + bridge.width / 2 + 3, bridge.y + bridge.height / 2 + 7, bridge.width + 8, bridge.height + 10, 0x050608, 0.52).setDepth(4.2))
  if (texture) {
    const tile = addTiledTexture(scene, bridge.x + bridge.width / 2, bridge.y + bridge.height / 2, bridge.width, bridge.height, texture, 5, null, frameFromSet(scene, 'bridge', index))
    if (!horizontal) tile.setAngle?.(90)
  } else track(scene, scene.add.rectangle(bridge.x + bridge.width / 2, bridge.y + bridge.height / 2, bridge.width, bridge.height, 0x7c6953, 1).setDepth(5))
}

function renderFeatureProp(scene, entry, kind, available, index, { height = 36, depth = 6.5, shadow = true } = {}) {
  const texture = spatialTextureKey(kind, available)
  if (shadow) track(scene, scene.add.ellipse(entry.x + 2, entry.y + 8, Math.max(22, height * 0.82), 10, 0x050607, 0.36).setDepth(depth - 0.2))
  if (!texture) return null
  const sprite = addScaledImage(scene, entry.x, entry.y, texture, height, depth, frameFromSet(scene, kind === 'object' ? 'objectDecoration' : kind, index))
  const orientationAngles = { left: -90, right: 90, up: 0, down: 180, top: 0, bottom: 180 }
  if (entry.orientation && orientationAngles[entry.orientation] != null) sprite.setAngle?.(orientationAngles[entry.orientation])
  if (entry.side && orientationAngles[entry.side] != null) sprite.setAngle?.(orientationAngles[entry.side])
  return sprite
}

function renderGeneratedFeatures(scene, geometry, available) {
  for (let index = 0; index < (geometry.bridges ?? []).length; index++) renderBridge(scene, geometry.bridges[index], available, index)
  for (let index = 0; index < (geometry.stairs ?? []).length; index++) renderFeatureProp(scene, geometry.stairs[index], 'stairs', available, index, { height: 34, depth: 5.4, shadow: false })
  for (let index = 0; index < (geometry.doors ?? []).length; index++) renderFeatureProp(scene, geometry.doors[index], 'door', available, index, { height: 54, depth: 7.2 })
  for (let index = 0; index < (geometry.traps ?? []).length; index++) {
    const trap = geometry.traps[index]
    renderFeatureProp(scene, trap, trap.kind, available, index, { height: trap.kind === 'spikes' ? 25 : 20, depth: 4.8, shadow: false })
  }
  for (let index = 0; index < (geometry.decorations ?? []).length; index++) {
    const prop = geometry.decorations[index]
    if (prop.kind === 'plate') continue
    const height = prop.kind === 'statue' ? 56 : prop.kind === 'arches' ? 62 : prop.kind === 'coffin' ? 38 : 28
    renderFeatureProp(scene, prop, prop.kind, available, index, { height, depth: 6.7 })
  }
}

function renderFloor(scene, geometry) {
  const background = track(scene, scene.add.graphics().setDepth(0))
  background.fillStyle(0x080a0d, 1).fillRect(0, 0, geometry.width, geometry.height)
  const tile = 48
  const available = textureAvailability(scene)
  const frames = scene.__dungeonEnvironmentFrames ?? {}
  const stacks = scene.__dungeonEnvironmentStacks ?? {}
  const animations = scene.__dungeonEnvironmentAnimations ?? {}
  const floorSkin = scene.__dungeonEnvironmentFloorSkin ?? null
  const floorTexture = spatialTextureKey('floor', available)

  if (geometry.grid) renderDungeon3Terrain(scene, geometry)
  else if (floorTexture) renderAuthoredFloorSkin(scene, geometry, floorTexture, spatialTextureFrame('floor', frames), floorSkin)
  else {
    for (let y = tile; y < geometry.height - tile; y += tile) for (let x = tile; x < geometry.width - tile; x += tile) {
      const shade = ((x / tile + y / tile) % 2 === 0) ? 0x2a241f : 0x25201c
      background.fillStyle(shade, 1).fillRect(x, y, tile, tile)
      background.lineStyle(1, 0x3a312a, 0.55).strokeRect(x, y, tile, tile)
    }
  }

  if (!geometry.grid) {
    renderFloorDecorations(scene, geometry, available)
    for (let waterIndex = 0; waterIndex < geometry.water.length; waterIndex++) renderAuthoredWater(scene, geometry, geometry.water[waterIndex], waterIndex, available, frames, animations)
    renderGeneratedFeatures(scene, geometry, available)
  }

  for (const solid of geometry.solids) {
    if (geometry.grid) continue
    const isBoundary = solid.kind === 'boundary'
    const isPillar = solid.kind === 'pillar'
    const texture = spatialTextureKey(solid.kind, available)
    const depth = isBoundary ? 4 : 6
    if (isPillar) track(scene, scene.add.ellipse(solid.x + solid.width / 2 + 2, solid.y + solid.height + 5, Math.max(34, solid.width * 1.15), 15, 0x050607, 0.42).setDepth(depth - 1))
    else track(scene, scene.add.rectangle(solid.x + solid.width / 2 + (isBoundary ? 0 : 4), solid.y + solid.height / 2 + (isBoundary ? 0 : 6), solid.width, solid.height, 0x050607, isBoundary ? 0.34 : 0.42).setDepth(depth - 1))
    if (texture) {
      const tileStack = spatialTileStack(solid.kind, stacks)
      if (tileStack) { addStackedTileProp(scene, solid.x + solid.width / 2, solid.y + solid.height + 2, texture, tileStack, Math.max(64, solid.height + 24), depth); continue }
      addTiledTexture(scene, solid.x + solid.width / 2, solid.y + solid.height / 2, Math.max(2, solid.width - 2), Math.max(2, solid.height - 2), texture, depth, spatialSurfaceTint(solid.kind), spatialTextureFrame(solid.kind, frames))
      continue
    }
    const color = isBoundary ? 0x303b49 : solid.kind === 'pillar' ? 0x555d66 : 0x48515c
    const edge = isBoundary ? 0x708095 : 0x8b949f
    track(scene, scene.add.rectangle(solid.x + solid.width / 2, solid.y + solid.height / 2, Math.max(2, solid.width - 2), Math.max(2, solid.height - 2), color, 0.98).setStrokeStyle(isBoundary ? 1 : 2, edge, 0.9).setDepth(depth))
  }

  for (let index = 0; index < geometry.torches.length; index++) {
    const torch = geometry.torches[index]
    const glow = track(scene, scene.add.circle(torch.x, torch.y, 42, 0xff8a3d, 0.08).setDepth(7))
    const torchTexture = spatialTextureKey('torch', available)
    if (torchTexture) {
      const variants = scene.__dungeonEnvironmentTorchVariants ?? []
      const frame = variants.length ? variants[index % variants.length] : spatialTextureFrame('torch', frames)
      const sprite = addScaledImage(scene, torch.x, torch.y + 2, torchTexture, 34, 9, frame)
      scene.tweens.add({ targets: glow, alpha: 0.2, scale: 1.22, duration: 780 + (index % 4) * 55, yoyo: true, repeat: -1 })
      scene.tweens.add({ targets: sprite, y: sprite.y - 1, duration: 460 + (index % 3) * 50, yoyo: true, repeat: -1 })
      continue
    }
    const outer = track(scene, scene.add.circle(torch.x, torch.y - 3, 9, 0xff7b35, 0.62).setDepth(8))
    const core = track(scene, scene.add.circle(torch.x, torch.y - 5, 4, 0xffe39a, 0.96).setDepth(9))
    track(scene, scene.add.rectangle(torch.x, torch.y + 10, 5, 18, 0x7e5638, 1).setDepth(7))
    scene.tweens.add({ targets: glow, alpha: 0.2, scale: 1.22, duration: 780, yoyo: true, repeat: -1 })
    scene.tweens.add({ targets: [outer, core], y: '-=4', scaleX: 0.72, duration: 340, yoyo: true, repeat: -1 })
  }
}

function renderChest(scene, anchor, index) {
  const x = anchor.x, y = anchor.y
  const available = textureAvailability(scene)
  const frames = scene.__dungeonEnvironmentFrames ?? {}
  const shadow = track(scene, scene.add.ellipse(x + 4, y + 12, 38, 15, 0x020304, 0.46).setDepth(8))
  const glow = track(scene, scene.add.circle(x, y, 28, 0xffcf68, 0.05).setDepth(10))
  const chestTexture = spatialTextureKey('chest', available)
  let sprite = null, base = null, lid = null, lock = null
  if (chestTexture) sprite = addScaledImage(scene, x, y, chestTexture, 34, 13, spatialTextureFrame('chest', frames))
  else {
    base = track(scene, scene.add.rectangle(x, y + 4, 38, 24, 0x8b542c, 1).setStrokeStyle(2, 0xd5964e, 0.95).setDepth(12))
    lid = track(scene, scene.add.rectangle(x, y - 9, 40, 14, 0xb36b34, 1).setStrokeStyle(2, 0xf0b35f, 0.95).setDepth(13))
    lock = track(scene, scene.add.rectangle(x, y + 2, 7, 10, 0xffd86b, 1).setDepth(14))
  }
  scene.tweens.add({ targets: glow, alpha: 0.14, scale: 1.15, duration: 900, yoyo: true, repeat: -1 })
  return { id: `chest-${index}`, x, y, opened: false, visuals: { shadow, sprite, base, lid, lock, glow }, prompt: null }
}

function openChestVisual(scene, chest) {
  if (!chest || chest.opened) return
  chest.opened = true
  chest.visuals.lock?.setVisible(false)
  if (chest.visuals.sprite) {
    animateOnce(scene, chest.visuals.sprite, spatialAnimation('chest', scene.__dungeonEnvironmentAnimations ?? {}), scene.__dungeonEnvironmentOpenFrames?.chest)
    scene.tweens.add({ targets: chest.visuals.sprite, y: chest.y - 2, duration: 120, yoyo: true, ease: 'Back.Out' })
  } else scene.tweens.add({ targets: chest.visuals.lid, y: chest.y - 23, angle: -8, duration: 160, ease: 'Back.Out' })
  scene.tweens.add({ targets: chest.visuals.glow, alpha: 0.55, scale: 1.7, duration: 220, yoyo: true, onComplete: () => chest.visuals.glow?.setAlpha?.(0.08) })
  scene.__dungeonVfx?.sparkle?.(chest.x, chest.y - 22, { width: 52, height: 52, depth: 28 })
}

function showChestPrompt(scene, chest, label) {
  if (chest?.prompt) return
  chest.prompt = scene.add.text(chest.x, chest.y - 42, `[E] ${label('openChest')}`, { fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace', fontSize: '11px', fontStyle: 'bold', color: '#ffd86b', stroke: '#08090b', strokeThickness: 4 }).setOrigin(0.5).setDepth(36)
}
function hideChestPrompt(chest) { chest?.prompt?.destroy?.(); if (chest) chest.prompt = null }

function queueEnvironmentTexture(scene, key, asset) {
  if (!asset?.path || scene.textures?.exists?.(key)) return false
  if ((asset.frames ?? 1) > 1 && asset.frameWidth > 0 && asset.frameHeight > 0) scene.load.spritesheet(key, asset.path, { frameWidth: asset.frameWidth, frameHeight: asset.frameHeight, endFrame: asset.frames - 1 })
  else scene.load.image(key, asset.path)
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
      scene.__dungeonEnvironmentFrames = Object.fromEntries(Object.entries(selected).map(([kind, asset]) => [kind, asset?.frame ?? 0]))
      scene.__dungeonEnvironmentFrameSets = Object.fromEntries(Object.entries(selected).filter(([, asset]) => Array.isArray(asset?.frameset) && asset.frameset.length).map(([kind, asset]) => [kind, [...asset.frameset]]))
      scene.__dungeonEnvironmentStacks = Object.fromEntries(Object.entries(selected).filter(([, asset]) => Array.isArray(asset?.tileStack) && asset.tileStack.length).map(([kind, asset]) => [kind, [...asset.tileStack]]))
      scene.__dungeonEnvironmentAnimations = Object.fromEntries(Object.entries(selected).filter(([, asset]) => Array.isArray(asset?.animation) && asset.animation.length).map(([kind, asset]) => [kind, asset.animation.map((entry) => ({ ...entry }))]))
      scene.__dungeonEnvironmentOpenFrames = Object.fromEntries(Object.entries(selected).filter(([, asset]) => Number.isInteger(asset?.openFrame)).map(([kind, asset]) => [kind, asset.openFrame]))
      scene.__dungeonEnvironmentFloorSkin = { autotile: selected.floor?.autotile ? { ...selected.floor.autotile } : null, detailFrames: Array.isArray(selected.floor?.detailFrames) ? [...selected.floor.detailFrames] : [] }
      scene.__dungeonEnvironmentDecorationFrames = Array.isArray(selected.floorDecoration?.frameset) ? [...selected.floorDecoration.frameset] : []
      scene.__dungeonEnvironmentWaterFrames = Array.isArray(selected.water?.coastFrames) ? [...selected.water.coastFrames] : []
      scene.__dungeonEnvironmentWaterCoasts = selected.water?.coasts ? structuredClone(selected.water.coasts) : null
      scene.__dungeonEnvironmentTorchVariants = Array.isArray(selected.torch?.variants) ? [...selected.torch.variants] : []
      const queue = [
        ['dungeon-tileset-floor', selected.floor], ['dungeon-tileset-floor-decoration', selected.floorDecoration], ['dungeon-tileset-wall', selected.wall],
        ['dungeon-tileset-water', selected.water], ['dungeon-tileset-water-detail', selected.waterDetail], ['dungeon-tileset-obstacle', selected.obstacle],
        ['dungeon-tileset-torch', selected.torch], ['dungeon-tileset-chest', selected.chest], ['dungeon-tileset-bridge', selected.bridge],
        ['dungeon-tileset-stairs', selected.stairs], ['dungeon-tileset-door', selected.door], ['dungeon-tileset-statue', selected.statue],
        ['dungeon-tileset-coffin', selected.coffin], ['dungeon-tileset-object', selected.objectDecoration], ['dungeon-tileset-trap-plate', selected.trapPlate],
        ['dungeon-tileset-trap-spikes', selected.trapSpikes], ['dungeon-tileset-candles', selected.candles], ['dungeon-tileset-arches', selected.arches],
      ]
      const gridQueued = queueDungeon3Textures(scene)
      const queued = queue.map(([key, asset]) => queueEnvironmentTexture(scene, key, asset)).some(Boolean) || gridQueued
      if (!queued) return true
      await new Promise((resolve) => { scene.load.once('complete', resolve); scene.load.start() })
      return true
    }
    const fallback = selectDebtsEnvironmentAssets(manifest)
    const queue = [['dungeon-obstacle', fallback.obstacle], ['dungeon-torch', fallback.torch], ['dungeon-chest', fallback.chest]]
    const queued = queue.map(([key, asset]) => queueEnvironmentTexture(scene, key, asset)).some(Boolean)
    if (!queued) return false
    await new Promise((resolve) => { scene.load.once('complete', resolve); scene.load.start() })
    return true
  } catch { return false }
}

function enemyIsFlying(enemy) {
  if (enemy?.flying || enemy?.airborne) return true
  return /(?:bat|dragon|ghost|wing|fly)/i.test(String(enemy?.type ?? enemy?.archetype ?? enemy?.id ?? ''))
}
function collisionGeometryForEnemy(enemy, geometry) { return enemyIsFlying(enemy) ? { ...geometry, water: [] } : geometry }

export function installDungeonSpatial(scene, { getProgress = () => ({ floor: scene?.floor ?? 1, chapter: 1, roomRole: 'combat', fortuneActive: false }), onEvent = () => {}, label = (key) => key, random = Math.random } = {}) {
  if (!scene || scene.__dungeonSpatialInstalled) return scene?.__dungeonSpatial ?? null
  scene.__dungeonSpatialInstalled = true
  let chests = [], trapCooldownUntil = 0
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
    if (!fixedGeometry) placePlayerAtRoomSpawn(scene)
    const cellSize = geometry.grid?.tileSize ?? 32
    scene.__navGrids = {
      ground: buildNavGrid(geometry, { cellSize, actorRadius: ENEMY_RADIUS, profile: 'ground' }),
      boss: buildNavGrid(geometry, { cellSize, actorRadius: 26, profile: 'ground' }),
      flying: buildNavGrid(geometry, { cellSize, actorRadius: ENEMY_RADIUS, profile: 'flying' }),
    }
    scene.__navGrid = scene.__navGrids.ground
    scene.spawnPoints = geometry.spawnPoints.map((entry) => [entry.x, entry.y])
    if (progress.roomRole !== 'rest') chests = geometry.chests.slice(0, 1).map((anchor, index) => renderChest(scene, anchor, index))
    scene.__roomChests = chests
    for (const enemy of scene.enemies ?? []) {
      enemy.hitRadius = enemy.boss ? 26 : ENEMY_RADIUS
      const collisionGeometry = collisionGeometryForEnemy(enemy, geometry)
      if (!circleHitsSolid(enemy, enemy.hitRadius, collisionGeometry)) continue
      const spawn = safeEnemySpawn(collisionGeometry, enemy, enemy.hitRadius)
      if (!spawn) continue
      enemy.x = spawn.x; enemy.y = spawn.y
      enemy.visual?.setPosition?.(enemy.x, enemy.y)
      enemy.navPath = []; enemy.navRefreshAt = 0
    }
  }

  scene.drawArena = function drawSpatialArena() { refreshRoom() }
  scene.updatePlayer = function updateSpatialPlayer(dt) {
    const before = { x: scene.localPlayer.state.x, y: scene.localPlayer.state.y }
    if ((scene.__hitStopUntil ?? 0) > scene.time.now) { scene.localPlayer.moving = false; if (!scene.localPlayer.attacking) scene.syncPlayerAnimation?.(); return }
    originalUpdatePlayer(dt)
    const desired = { x: scene.localPlayer.state.x, y: scene.localPlayer.state.y }
    const next = movementWithCollision(before, { x: desired.x - before.x, y: desired.y - before.y }, PLAYER_RADIUS, scene.__roomGeometry)
    scene.localPlayer.state.x = next.x; scene.localPlayer.state.y = next.y
    scene.localPlayer.actor?.setPosition?.(next.x, next.y)
    scene.updateHealthBar?.(scene.localPlayer.bar, next.x, next.y - 42, scene.localPlayer.state.hp, scene.localPlayer.state.maxHp)
    const trap = activeTrapAt(next, scene.__roomGeometry, scene.time.now)
    if (trap && scene.time.now >= trapCooldownUntil) {
      trapCooldownUntil = scene.time.now + 850
      scene.hitPlayer?.(trap.kind === 'spikes' || trap.kind === 'wall-trap' ? 6 : 4)
      onEvent({ type: 'traptrigger', trap: trap.kind, x: trap.x, y: trap.y })
    }
  }

  function navigateEnemy(enemy, target, time, dt) {
    const geometry = scene.__roomGeometry
    if (!geometry || (scene.__hitStopUntil ?? 0) > time) return
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
    const dx = destination.x - enemy.x, dy = destination.y - enemy.y, distance = Math.hypot(dx, dy) || 1
    const next = movementWithCollision(enemy, { x: (dx / distance) * enemy.speed * dt, y: (dy / distance) * enemy.speed * dt }, enemy.hitRadius ?? ENEMY_RADIUS, collisionGeometry)
    enemy.x = next.x; enemy.y = next.y
  }

  scene.moveEnemyTowardPlayer = function moveSpatialEnemy(enemy, time, dt) {
    navigateEnemy(enemy, scene.localPlayer.state, time, dt)
    const dx = scene.localPlayer.state.x - enemy.x
    scene.syncEnemyVisual(enemy, time, dx, Math.hypot(dx, scene.localPlayer.state.y - enemy.y) || 1)
  }

  scene.updateRangedEnemy = function updateSpatialRanged(enemy, time, dt) {
    if ((scene.__hitStopUntil ?? 0) > time) return
    const dx = scene.localPlayer.state.x - enemy.x, dy = scene.localPlayer.state.y - enemy.y, distance = Math.hypot(dx, dy) || 1
    const preferred = enemy.preferredRange || 180
    const collisionGeometry = collisionGeometryForEnemy(enemy, scene.__roomGeometry)
    const los = clipSegmentToSolids(enemy, scene.localPlayer.state, collisionGeometry, 3)
    if (distance > enemy.attackRange || los.blocked) navigateEnemy(enemy, scene.localPlayer.state, time, dt)
    else if (distance < preferred - 34) {
      const next = movementWithCollision(enemy, { x: -(dx / distance) * enemy.speed * 0.72 * dt, y: -(dy / distance) * enemy.speed * 0.72 * dt }, enemy.hitRadius ?? ENEMY_RADIUS, collisionGeometry)
      enemy.x = next.x; enemy.y = next.y
    } else {
      const strafe = Math.sin((time + enemy.x * 7) / 650) * enemy.speed * 0.28 * dt
      const next = movementWithCollision(enemy, { x: (-dy / distance) * strafe, y: (dx / distance) * strafe }, enemy.hitRadius ?? ENEMY_RADIUS, collisionGeometry)
      enemy.x = next.x; enemy.y = next.y
    }
    const nextDx = scene.localPlayer.state.x - enemy.x, nextDy = scene.localPlayer.state.y - enemy.y, nextDistance = Math.hypot(nextDx, nextDy) || 1
    scene.syncEnemyVisual(enemy, time, nextDx, nextDistance)
    if (!clipSegmentToSolids(enemy, scene.localPlayer.state, collisionGeometry, 3).blocked && nextDistance <= enemy.attackRange && time >= enemy.nextProjectileAt) {
      enemy.nextProjectileAt = time + enemy.projectileCooldown
      scene.fireEnemyProjectile(enemy)
    }
  }

  scene.updateEnemyProjectiles = function updateSpatialProjectiles(dt) {
    if ((scene.__hitStopUntil ?? 0) > scene.time.now) return
    const projectileGeometry = scene.__roomGeometry ? { ...scene.__roomGeometry, water: [] } : scene.__roomGeometry
    for (let index = scene.enemyProjectiles.length - 1; index >= 0; index--) {
      const projectile = scene.enemyProjectiles[index]
      const next = { x: projectile.x + projectile.vx * dt, y: projectile.y + projectile.vy * dt }
      projectile.life -= dt
      const wallHit = circleHitsSolid(next, 5, projectileGeometry)
      if (!wallHit) { projectile.x = next.x; projectile.y = next.y; projectile.visual?.setPosition(projectile.x, projectile.y); projectile.glow?.setPosition(projectile.x, projectile.y) }
      const playerHit = !wallHit && Math.hypot(projectile.x - scene.localPlayer.state.x, projectile.y - scene.localPlayer.state.y) <= 20
      const expired = projectile.life <= 0
      if (!wallHit && !playerHit && !expired) continue
      if (playerHit) scene.hitPlayer(projectile.damage)
      projectile.visual?.destroy(); projectile.glow?.destroy(); scene.enemyProjectiles.splice(index, 1)
    }
  }

  scene.updateBoss = function updateSpatialBoss(enemy, time, dt) {
    const before = { x: enemy.x, y: enemy.y }
    originalUpdateBoss(enemy, time, dt)
    if (!scene.__roomGeometry) return
    const collisionGeometry = collisionGeometryForEnemy(enemy, scene.__roomGeometry)
    const corrected = movementWithCollision(before, { x: enemy.x - before.x, y: enemy.y - before.y }, enemy.hitRadius ?? 26, collisionGeometry)
    const blocked = corrected.x !== enemy.x || corrected.y !== enemy.y
    enemy.x = corrected.x; enemy.y = corrected.y
    if (blocked && time < enemy.chargingUntil) enemy.chargingUntil = time
    enemy.visual?.setPosition?.(enemy.x, enemy.y)
  }

  const updateInteraction = () => {
    const nearest = nearestInteractable(scene.localPlayer.state, chests, CHEST_RANGE)
    for (const chest of chests) { if (chest === nearest) showChestPrompt(scene, chest, label); else hideChestPrompt(chest) }
  }
  scene.events.on('update', updateInteraction)

  const openNearestChest = () => {
    const chest = nearestInteractable(scene.localPlayer.state, chests, CHEST_RANGE)
    if (!chest || chest.opened) return
    openChestVisual(scene, chest); hideChestPrompt(chest)
    const progress = getProgress() ?? {}
    const profile = chestRewardProfile(progress.roomRole ?? 'combat', progress.chapter ?? 1, Boolean(progress.fortuneActive))
    const floor = progress.floor ?? scene.floor ?? 1
    onEvent({ type: 'chestopen', floor, chapter: progress.chapter ?? 1, roomRole: progress.roomRole ?? 'combat' })
    scene.time.delayedCall(90, () => {
      for (let index = 0; index < profile.dropCount; index++) scene.spawnDrop(chest.x + (index - (profile.dropCount - 1) / 2) * 28, chest.y + 18, rollChestWeapon(profile, floor, random))
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
  loadEnvironmentTextures(scene).then((loaded) => { if (loaded && scene.__roomGeometry) refreshRoom({ geometry: scene.__roomGeometry }) })
  return api
}
