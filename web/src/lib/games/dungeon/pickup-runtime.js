import { nearestConfirmableDrop, pickupIntent } from './pickup.js'
import { lootMotion } from './combat-feel.js'
import { healthPotionPickupMode, shouldAutoUseHealthPotion, useStoredHealthPotion } from './inventory.js'
import { circleHitsSolid } from './spatial.js'
import { buildNavGrid, findPath } from './pathfinding.js'
import { weaponVisualProfile } from './weapon-visual-runtime.js'

const DAMAGE_RANGES = {
  common: [3, 6],
  uncommon: [6, 10],
  rare: [10, 16],
  epic: [16, 24],
}

const DROP_RADIUS = 18
const DROP_SEARCH_STEP = 16
const DROP_SEARCH_RADIUS = 160
const DROP_NAV_CELL = 16

function clamp01(value) { return Math.max(0, Math.min(0.999999, value)) }

export function weaponDamageForFloor(rarity = 'common', floor = 1, random = Math.random) {
  const [min, max] = DAMAGE_RANGES[rarity] ?? DAMAGE_RANGES.common
  const base = min + Math.floor(clamp01(random()) * (max - min + 1))
  const depth = Math.max(0, Math.floor(floor || 1) - 1)
  const floorBonus = Math.round(depth * 1.35 + depth * depth * 0.035)
  let damage = base + floorBonus
  if (clamp01(random()) < 0.08) damage = Math.round(damage * (1.5 + clamp01(random()) * 0.5))
  return Math.max(1, damage)
}

function nearOpenedChest(scene, x, y) {
  return (scene?.__dungeonSpatial?.getChests?.() ?? []).some((chest) => chest?.opened && Math.hypot((chest.x ?? 0) - x, (chest.y ?? 0) - y) <= 64)
}

export function prepareDropItem(scene, x, y, item, random = Math.random) {
  if (!item) return item
  if (scene?.__restoringFloor) return item
  if (nearOpenedChest(scene, x, y) && random() < 0.20) return { type: 'consumable.health_potion', rarity: 'common', healRatio: 0.30 }
  if (!item.type?.startsWith('weapon.')) return item
  const rolled = weaponDamageForFloor(item.rarity, scene?.floor ?? 1, random)
  return { ...item, damage: Math.max(item.damage ?? 0, rolled), affixes: [...(item.affixes ?? [])] }
}

function insideGeometryBounds(position, geometry, radius = DROP_RADIUS) {
  const bounds = geometry?.bounds ?? { x: 0, y: 0, width: geometry?.width ?? 0, height: geometry?.height ?? 0 }
  return position.x >= bounds.x + radius && position.x <= bounds.x + bounds.width - radius &&
    position.y >= bounds.y + radius && position.y <= bounds.y + bounds.height - radius
}

function dropPositionIsSafe(position, geometry) {
  return insideGeometryBounds(position, geometry) && !circleHitsSolid(position, DROP_RADIUS, geometry)
}

function dropNavGrid(scene, geometry) {
  const cached = scene?.__dungeonDropNavGrid
  if (cached?.geometry === geometry) return cached.grid
  const grid = buildNavGrid(geometry, { cellSize: DROP_NAV_CELL, actorRadius: DROP_RADIUS, profile: 'ground' })
  if (scene) scene.__dungeonDropNavGrid = { geometry, grid }
  return grid
}

function dropPositionIsReachable(position, geometry, player, grid) {
  if (!player || !dropPositionIsSafe(position, geometry)) return false
  return findPath(grid, player, position).length > 0
}

function candidateRing(origin, radius) {
  const candidates = []
  for (let offset = -radius; offset <= radius; offset += DROP_SEARCH_STEP) {
    candidates.push(
      { x: origin.x + offset, y: origin.y - radius },
      { x: origin.x + offset, y: origin.y + radius },
      { x: origin.x - radius, y: origin.y + offset },
      { x: origin.x + radius, y: origin.y + offset },
    )
  }
  const unique = new Map(candidates.map((candidate) => [`${candidate.x},${candidate.y}`, candidate]))
  return [...unique.values()].sort((a, b) => Math.hypot(a.x - origin.x, a.y - origin.y) - Math.hypot(b.x - origin.x, b.y - origin.y))
}

export function resolveDropPosition(scene, x, y) {
  const geometry = scene?.__dungeonSpatial?.getGeometry?.()
  const requested = { x: Number(x) || 0, y: Number(y) || 0 }
  if (!geometry) return requested

  const player = scene?.playerState
  if (!player) return requested
  const grid = dropNavGrid(scene, geometry)

  if (dropPositionIsReachable(requested, geometry, player, grid)) return requested

  for (let radius = DROP_SEARCH_STEP; radius <= DROP_SEARCH_RADIUS; radius += DROP_SEARCH_STEP) {
    const reachable = candidateRing(requested, radius).find((candidate) => dropPositionIsReachable(candidate, geometry, player, grid))
    if (reachable) return reachable
  }

  if (dropPositionIsReachable(player, geometry, player, grid)) return { x: player.x, y: player.y }

  for (let radius = DROP_SEARCH_STEP; radius <= DROP_SEARCH_RADIUS; radius += DROP_SEARCH_STEP) {
    const reachable = candidateRing(player, radius).find((candidate) => dropPositionIsReachable(candidate, geometry, player, grid))
    if (reachable) return reachable
  }

  return requested
}

function currentWeapon(scene) {
  if (!scene?.playerState?.weapon) return null
  const equipped = scene.playerState.equippedWeapon
  if (equipped) return { ...equipped, affixes: [...(equipped.affixes ?? [])] }
  return {
    type: scene.playerState.weapon,
    rarity: scene.playerState.weaponRarity ?? null,
    damage: scene.playerState.weaponDamage ?? 0,
    affixes: [...(scene.playerState.weaponAffixes ?? [])],
  }
}

function syncGroundWeaponVisual(scene, drop, position) {
  const profile = weaponVisualProfile(drop?.item)
  if (!profile || !scene?.textures?.exists?.(profile.textureKey) || !scene.add?.image) return
  const visual = scene.add.image(position.x, position.y, profile.textureKey)
  visual?.setDepth?.(15)
  visual?.setScale?.(profile.scale)
  drop.visual?.destroy?.()
  drop.visual = visual
}

export function installPickupInteraction(scene, { onSelection = () => {}, random = Math.random } = {}) {
  if (!scene || scene.__pickupInteractionInstalled) return scene?.__dungeonPickupRuntime ?? null
  scene.__pickupInteractionInstalled = true
  scene.playerState.healthPotions ??= 0

  const originalSpawnDrop = scene.spawnDrop.bind(scene)
  const originalUpdateDrops = scene.updateDrops.bind(scene)
  const originalClearDrops = scene.clearDrops.bind(scene)
  const originalEmitStats = scene.emitStats.bind(scene)
  const key = scene.input?.keyboard?.addKey?.('E')
  let selected = null

  scene.emitStats = function emitStatsWithInventory(now) {
    originalEmitStats(now)
  }

  const spawnDropWithMotion = (x, y, item, { prepare = true } = {}) => {
    const position = resolveDropPosition(scene, x, y)
    const preparedItem = prepare ? prepareDropItem(scene, position.x, position.y, item, random) : item
    const before = scene.drops?.length ?? 0
    originalSpawnDrop(position.x, position.y, preparedItem)
    const drop = scene.drops?.[before]
    if (!drop) return null
    syncGroundWeaponVisual(scene, drop, position)
    drop.spawnedAt = scene.time?.now ?? 0
    drop.groundY = position.y
    drop.baseScaleX = drop.visual?.scaleX ?? 1
    drop.baseScaleY = drop.visual?.scaleY ?? 1
    drop.visual?.setY?.(position.y - 72)
    drop.visual?.setScale?.(drop.baseScaleX * 0.82, drop.baseScaleY * 0.82)
    drop.glow?.setAlpha?.(0)
    return drop
  }

  scene.spawnDrop = function spawnPreparedDrop(x, y, item) { return spawnDropWithMotion(x, y, item) }

  const useHealthPotion = () => {
    const next = useStoredHealthPotion(scene.playerState)
    if (!next.used) return false
    scene.playerState.hp = next.hp
    scene.playerState.healthPotions = next.healthPotions
    scene.updateHealthBar?.(scene.playerBar, scene.playerState.x, scene.playerState.y - 42, scene.playerState.hp, scene.playerState.maxHp)
    scene.pickupBurst?.(scene.playerState.x, scene.playerState.y, { type: 'consumable.health_potion' }, next.healed)
    scene.__dungeonInventoryStats?.(scene.playerState.healthPotions)
    originalEmitStats()
    return true
  }

  const autoUseHealthPotion = () => {
    if (scene.dead || scene.runComplete || !shouldAutoUseHealthPotion(scene.playerState)) return false
    return useHealthPotion()
  }

  const api = {
    spawnExact(x, y, item) { return spawnDropWithMotion(x, y, item, { prepare: false }) },
    useHealthPotion,
    autoUseHealthPotion,
    getHealthPotions() { return scene.playerState.healthPotions ?? 0 },
  }
  scene.__dungeonPickupRuntime = api

  const publish = (next) => {
    if (selected === next) return
    selected = next
    onSelection(next ? { current: currentWeapon(scene), candidate: next.item } : null)
  }

  const equipSelected = () => {
    if (!selected || !scene.drops?.includes(selected)) return
    const distance = Math.hypot(selected.x - scene.playerState.x, selected.y - scene.playerState.y)
    if (distance > 34) return
    const previous = currentWeapon(scene)
    const x = selected.x
    const y = selected.y
    const rest = scene.drops.filter((drop) => drop !== selected)
    scene.drops = [selected]
    originalUpdateDrops()
    const equipped = scene.drops.length === 0
    scene.drops = equipped ? rest : [selected, ...rest]
    if (equipped && previous) spawnDropWithMotion(x, y, previous, { prepare: false })
    if (equipped) publish(null)
  }

  key?.on?.('down', equipSelected)

  scene.updateDrops = function updateDropsWithConfirmation() {
    const now = scene.time?.now ?? 0
    for (const drop of scene.drops ?? []) {
      if (drop.spawnedAt == null || !drop.visual) continue
      const motion = lootMotion(now - drop.spawnedAt, drop.groundY ?? drop.y, 72)
      drop.visual.setY?.(motion.y)
      drop.visual.setScale?.((drop.baseScaleX ?? 1) * motion.scale, (drop.baseScaleY ?? 1) * motion.scale)
      if (drop.glow && now - drop.spawnedAt < 420) drop.glow.setAlpha?.(Math.min(0.75, (now - drop.spawnedAt) / 420 * 0.65))
    }

    const allDrops = [...(scene.drops ?? [])]
    const confirmDrops = allDrops.filter((drop) => pickupIntent(drop.item) === 'confirm')
    const automaticDrops = allDrops.filter((drop) => pickupIntent(drop.item) !== 'confirm')
    const remainingAutomatic = []

    for (const drop of automaticDrops) {
      const potion = drop.item?.type === 'consumable.health_potion'
      const nearby = Math.hypot((drop.x ?? 0) - scene.playerState.x, (drop.y ?? 0) - scene.playerState.y) <= 34
      if (potion && nearby && healthPotionPickupMode(scene.playerState) === 'store') {
        scene.playerState.healthPotions = (scene.playerState.healthPotions ?? 0) + 1
        scene.destroyDrop?.(drop)
        scene.__dungeonInventoryStats?.(scene.playerState.healthPotions)
        scene.pickupBurst?.(drop.x, drop.y, drop.item, 0)
        autoUseHealthPotion()
        continue
      }
      remainingAutomatic.push(drop)
    }

    scene.drops = remainingAutomatic
    originalUpdateDrops()
    scene.drops = [...confirmDrops, ...scene.drops]
    publish(nearestConfirmableDrop(scene.playerState, confirmDrops, 34))
  }

  const autoPotionUpdate = () => autoUseHealthPotion()
  scene.events?.on?.('update', autoPotionUpdate)

  scene.clearDrops = function clearDropsWithSelectionReset() {
    publish(null)
    originalClearDrops()
  }

  scene.events?.once?.('shutdown', () => {
    key?.off?.('down', equipSelected)
    scene.events?.off?.('update', autoPotionUpdate)
    publish(null)
    scene.__dungeonDropNavGrid = null
    if (scene.__dungeonPickupRuntime === api) scene.__dungeonPickupRuntime = null
  })

  return api
}
