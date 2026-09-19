import { nearestConfirmableDrop, pickupIntent } from './pickup.js'
import { pickupHealthPotion, shouldAutoUseHealthPotion, useStoredHealthPotion } from './inventory.js'
import { ensureDungeonLootRuntime, installDungeonLootSceneBridge } from './loot-runtime.js'
import { currentWeapon as currentPlayerWeapon } from './player-loadout.js'
import { circleHitsSolid } from './spatial.js'
import { buildNavGrid, findPath } from './pathfinding.js'
import { weaponIdentityLabel } from './presentation.js'
import {
  cleanupGroundDropPresentation,
  reconcileGroundDropPresentation,
  setGroundDropSelected,
  syncGroundDropLabel,
  syncGroundDropPresentation,
  updateGroundDropPresentation,
} from './ground-drop-presentation.js'

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

export function groundWeaponLabel(item, locale = 'en') {
  return weaponIdentityLabel(item, locale)
}

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

export function resolveDropPosition(scene, x, y, player = scene?.localPlayer) {
  const geometry = scene?.__dungeonSpatial?.getGeometry?.()
  const requested = { x: Number(x) || 0, y: Number(y) || 0 }
  if (!geometry) return requested

  const state = player?.state
  if (!state) return requested
  const grid = dropNavGrid(scene, geometry)

  if (dropPositionIsReachable(requested, geometry, state, grid)) return requested

  for (let radius = DROP_SEARCH_STEP; radius <= DROP_SEARCH_RADIUS; radius += DROP_SEARCH_STEP) {
    const reachable = candidateRing(requested, radius).find((candidate) => dropPositionIsReachable(candidate, geometry, state, grid))
    if (reachable) return reachable
  }

  if (dropPositionIsReachable(state, geometry, state, grid)) return { x: state.x, y: state.y }

  for (let radius = DROP_SEARCH_STEP; radius <= DROP_SEARCH_RADIUS; radius += DROP_SEARCH_STEP) {
    const reachable = candidateRing(state, radius).find((candidate) => dropPositionIsReachable(candidate, geometry, state, grid))
    if (reachable) return reachable
  }

  return requested
}

function currentWeapon(player) {
  const equipped = currentPlayerWeapon(player?.state)
  return equipped ? { ...equipped, affixes: [...(equipped.affixes ?? [])] } : null
}

export function installPlayerInventoryRuntime(scene, player, { emitStats = () => {} } = {}) {
  if (!scene || !player) return null
  player.runtime ??= {}
  if (player.runtime.inventory) return player.runtime.inventory
  player.state.healthPotions ??= 0

  const useHealthPotion = () => {
    const next = useStoredHealthPotion(player.state)
    if (!next.used) return false
    player.state.hp = next.hp
    player.state.healthPotions = next.healthPotions
    scene.updateHealthBar?.(player.bar, player.state.x, player.state.y - 42, player.state.hp, player.state.maxHp)
    scene.pickupBurst?.(player.state.x, player.state.y, { type: 'consumable.health_potion' }, next.healed)
    scene.__dungeonInventoryStats?.(player.state.healthPotions)
    emitStats()
    return true
  }

  const autoUseHealthPotion = () => {
    if (player.dead || scene.runComplete || !shouldAutoUseHealthPotion(player.state)) return false
    return useHealthPotion()
  }

  let api = null
  const restore = () => {
    if (player.runtime?.inventory === api) delete player.runtime.inventory
  }

  api = {
    useHealthPotion,
    autoUseHealthPotion,
    getHealthPotions: () => player.state.healthPotions ?? 0,
    restore,
  }
  player.runtime.inventory = api
  return api
}

export function installPickupInteraction(scene, {
  onSelection = () => {},
  random = Math.random,
  getLocale = () => 'en',
  player = scene?.localPlayer,
} = {}) {
  if (!scene || !player) return null
  if (scene.__pickupInteractionInstalled) return scene.__dungeonPickupRuntime ?? null
  scene.__pickupInteractionInstalled = true

  installDungeonLootSceneBridge(scene)
  const loot = ensureDungeonLootRuntime(scene)
  const originalEmitStats = typeof scene.emitStats === 'function' ? scene.emitStats.bind(scene) : () => {}
  const inventory = installPlayerInventoryRuntime(scene, player, {
    emitStats: () => { if (player === scene.localPlayer) originalEmitStats() },
  })
  const key = scene.input?.keyboard?.addKey?.('E')
  let selectedKey = null
  let selectedFingerprint = null
  let localDropSequence = 0
  let pickupIntentHandler = null
  let restored = false
  let api = null

  const selectionKey = (drop) => {
    if (!drop) return null
    if (!drop.__dungeonPickupSelectionKey) {
      const id = String(drop.id ?? '').trim()
      drop.__dungeonPickupSelectionKey = id ? `id:${id}` : `local:${++localDropSequence}`
    }
    return drop.__dungeonPickupSelectionKey
  }

  const dropBySelectionKey = (value) => (scene.drops ?? []).find((drop) => drop && selectionKey(drop) === value) ?? null
  const selectedDrop = () => selectedKey ? dropBySelectionKey(selectedKey) : null

  const selectionFingerprint = (drop) => {
    if (!drop) return null
    return JSON.stringify({
      key: selectionKey(drop),
      current: currentWeapon(player),
      candidate: drop.item ?? null,
    })
  }

  const applySelectionArt = (drop, active) => {
    setGroundDropSelected(scene, drop, active)
  }

  const publish = (next) => {
    const nextKey = next ? selectionKey(next) : null
    const nextFingerprint = next ? selectionFingerprint(next) : null
    if (selectedKey === nextKey && selectedFingerprint === nextFingerprint) return
    const keyChanged = selectedKey !== nextKey
    const previous = selectedDrop()
    if (keyChanged) applySelectionArt(previous, false)
    selectedKey = nextKey
    selectedFingerprint = nextFingerprint
    applySelectionArt(next, true)
    onSelection(next ? { current: currentWeapon(player), candidate: next.item } : null)
  }

  const removeOwner = (drop, coreRemove) => {
    if (!drop) return null
    if (selectedKey && selectionKey(drop) === selectedKey) publish(null)
    cleanupGroundDropPresentation(scene, drop)
    coreRemove?.(drop)
    return drop
  }

  const clearOwner = () => {
    publish(null)
    for (const drop of [...(scene.drops ?? [])]) loot.remove(drop, { reason: 'clear' })
    scene.drops = []
    return null
  }

  const spawnOwner = (request, coreSpawn) => {
    const position = resolveDropPosition(scene, request.x, request.y, player)
    const preparedItem = request.prepare
      ? prepareDropItem(scene, position.x, position.y, request.item, random)
      : request.item
    const drop = coreSpawn({ ...request, x: position.x, y: position.y, item: preparedItem })
    if (!drop) return null
    syncGroundDropPresentation(scene, drop, {
      x: position.x,
      y: position.y,
      now: scene.time?.now ?? 0,
      locale: getLocale(),
    })
    return drop
  }

  const reconcileVisuals = ({ force = false } = {}) => {
    let created = 0
    const now = scene.time?.now ?? 0
    for (const drop of scene.drops ?? []) {
      if (reconcileGroundDropPresentation(scene, drop, {
        now,
        locale: getLocale(),
        force,
        selected: Boolean(selectedKey && selectionKey(drop) === selectedKey),
      })) created++
    }
    return created
  }

  const interceptPickup = (target, drop) => {
    if (typeof pickupIntentHandler !== 'function') return false
    return pickupIntentHandler(target, drop) === true
  }

  const equipSelected = (coreUpdate) => {
    const candidate = selectedDrop()
    if (!candidate) return null
    const distance = Math.hypot(candidate.x - player.state.x, candidate.y - player.state.y)
    if (distance > 34) return null
    if (interceptPickup(player, candidate)) {
      publish(null)
      return null
    }
    const previous = currentWeapon(player)
    const x = candidate.x
    const y = candidate.y
    const rest = scene.drops.filter((drop) => drop && drop !== candidate)

    publish(null)
    scene.drops = [candidate]
    coreUpdate(player)
    const equipped = scene.drops.length === 0
    scene.drops = equipped ? rest : [candidate, ...rest]
    if (equipped && previous) loot.spawnExact(x, y, previous)
    return equipped
  }

  const stepOwner = (target = player, coreUpdate, context = {}) => {
    if (!target) return null
    if (context?.confirmSelection) return equipSelected(coreUpdate)

    scene.drops = (scene.drops ?? []).filter(Boolean)
    const now = scene.time?.now ?? 0
    for (const drop of scene.drops) updateGroundDropPresentation(scene, drop, now)

    const allDrops = [...scene.drops]
    const confirmDrops = allDrops.filter((drop) => pickupIntent(drop.item) === 'confirm')
    const automaticDrops = allDrops.filter((drop) => pickupIntent(drop.item) !== 'confirm')
    const deferredAutomatic = []
    const remainingAutomatic = []

    for (const drop of automaticDrops) {
      const potion = drop.item?.type === 'consumable.health_potion'
      const nearby = Math.hypot((drop.x ?? 0) - target.state.x, (drop.y ?? 0) - target.state.y) <= 34
      if (nearby && interceptPickup(target, drop)) {
        deferredAutomatic.push(drop)
        continue
      }
      if (potion && nearby) {
        const result = pickupHealthPotion(target.state)
        Object.assign(target.state, result.state)
        loot.remove(drop, { player: target, reason: 'automatic' })
        if (result.stored) scene.__dungeonInventoryStats?.(target.state.healthPotions)
        else scene.updateHealthBar?.(target.bar, target.state.x, target.state.y - 42, target.state.hp, target.state.maxHp)
        scene.pickupBurst?.(drop.x, drop.y, drop.item, result.healed)
        if (target === scene.localPlayer) originalEmitStats()
        continue
      }
      remainingAutomatic.push(drop)
    }

    scene.drops = remainingAutomatic
    coreUpdate(target)
    scene.drops = [...confirmDrops, ...deferredAutomatic, ...(scene.drops ?? []).filter(Boolean)]
    if (target === player) publish(nearestConfirmableDrop(target.state, confirmDrops, 34))
    return null
  }

  const restoreSpawnOwner = loot.setSpawnOwner(spawnOwner)
  const restoreRemoveOwner = loot.setRemoveOwner(removeOwner)
  const restoreClearOwner = loot.setClearOwner(clearOwner)
  const restoreStepOwner = loot.setStepOwner(stepOwner)
  const restorePresentationOwner = loot.setPresentationOwner(reconcileVisuals)

  const confirmSelected = () => loot.step(player, { confirmSelection: true })
  const reconcileLoadedVisuals = () => reconcileVisuals({ force: true })
  key?.on?.('down', confirmSelected)
  scene.load?.on?.('complete', reconcileLoadedVisuals)

  const autoPotionUpdate = () => inventory?.autoUseHealthPotion?.()
  scene.events?.on?.('update', autoPotionUpdate)

  const restore = () => {
    if (restored) return
    restored = true
    key?.off?.('down', confirmSelected)
    scene.events?.off?.('update', autoPotionUpdate)
    scene.load?.off?.('complete', reconcileLoadedVisuals)
    publish(null)
    pickupIntentHandler = null
    scene.__dungeonDropNavGrid = null
    scene.__pickupInteractionInstalled = false
    restorePresentationOwner()
    restoreStepOwner()
    restoreClearOwner()
    restoreRemoveOwner()
    restoreSpawnOwner()
    inventory?.restore?.()
    if (scene.__dungeonPickupRuntime === api) scene.__dungeonPickupRuntime = null
  }

  api = {
    inventory,
    spawnExact(x, y, item) { return loot.spawnExact(x, y, item) },
    removeById(id) { return loot.removeById(id) },
    clearAll() { return loot.clear() },
    reconcileVisuals,
    useHealthPotion: () => inventory?.useHealthPotion?.() ?? false,
    autoUseHealthPotion: () => inventory?.autoUseHealthPotion?.() ?? false,
    setPickupIntentHandler(handler = null) {
      const previous = pickupIntentHandler
      pickupIntentHandler = typeof handler === 'function' ? handler : null
      return previous
    },
    refreshLabels() {
      for (const drop of scene.drops ?? []) syncGroundDropLabel(drop, getLocale())
    },
    getHealthPotions: () => inventory?.getHealthPotions?.() ?? 0,
    restore,
  }
  scene.__dungeonPickupRuntime = api
  scene.events?.once?.('shutdown', restore)
  return api
}
