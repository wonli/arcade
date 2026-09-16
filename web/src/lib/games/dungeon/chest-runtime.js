import { rollAffixes } from './affixes.js'
import { chestRewardProfile, nearestInteractable } from './interactables.js'

const DEFAULT_CHEST_RANGE = 48
const RARITY_DAMAGE = {
  common: [2, 3],
  uncommon: [4, 5],
  rare: [6, 8],
  epic: [9, 12],
}

function clamp01(value) {
  return Math.max(0, Math.min(0.999999, Number(value) || 0))
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

export function chestEntityId(floor, index) {
  const normalizedFloor = Math.max(1, Math.floor(Number(floor) || 1))
  const normalizedIndex = Math.max(0, Math.floor(Number(index) || 0))
  return `floor-${normalizedFloor}:chest-${normalizedIndex}`
}

export function createDungeonChestRuntime(scene, {
  getChests = () => [],
  getProgress = () => ({ floor: scene?.floor ?? 1, chapter: 1, roomRole: 'combat', fortuneActive: false }),
  onEvent = () => {},
  random = Math.random,
  openVisual = (_scene, chest) => { if (chest) chest.opened = true },
  hidePrompt = () => {},
  range = DEFAULT_CHEST_RANGE,
} = {}) {
  if (!scene || typeof scene !== 'object') throw new TypeError('Dungeon scene is required')

  let intentHandler = null
  let openedHandler = null

  const openedSet = () => {
    if (!(scene.__dungeonOpenedChestIds instanceof Set)) {
      scene.__dungeonOpenedChestIds = new Set(
        Array.isArray(scene.__dungeonOpenedChestIds) ? scene.__dungeonOpenedChestIds : [],
      )
    }
    return scene.__dungeonOpenedChestIds
  }

  const chestById = (chestId) => {
    const id = String(chestId ?? '').trim()
    if (!id) return null
    return (getChests() ?? []).find((chest) => String(chest?.id ?? '') === id) ?? null
  }

  const reward = (chest) => {
    const progress = getProgress() ?? {}
    const profile = chestRewardProfile(
      progress.roomRole ?? 'combat',
      progress.chapter ?? 1,
      Boolean(progress.fortuneActive),
    )
    const floor = Math.max(1, Math.floor(Number(progress.floor ?? scene.floor) || 1))
    const spawn = () => {
      for (let index = 0; index < profile.dropCount; index++) {
        scene.spawnDrop?.(
          chest.x + (index - (profile.dropCount - 1) / 2) * 28,
          chest.y + 18,
          rollChestWeapon(profile, floor, random),
        )
      }
    }
    if (scene.time?.delayedCall) scene.time.delayedCall(90, spawn)
    else spawn()
    return { floor, progress, profile }
  }

  const openById = (player, chestId) => {
    const id = String(chestId ?? '').trim()
    const chest = chestById(id)
    if (!chest) return { opened: false, reason: 'chest-not-found', chestId: id }
    if (chest.opened || openedSet().has(id)) {
      if (!chest.opened) openVisual(scene, chest)
      return { opened: false, reason: 'already-opened', chestId: id }
    }
    if (!player || player.dead || Number(player.state?.hp ?? 0) <= 0) {
      return { opened: false, reason: 'player-dead', chestId: id }
    }
    const distance = Math.hypot(
      Number(chest.x ?? 0) - Number(player.state?.x ?? 0),
      Number(chest.y ?? 0) - Number(player.state?.y ?? 0),
    )
    if (distance > range) return { opened: false, reason: 'out-of-range', chestId: id }

    openedSet().add(id)
    openVisual(scene, chest)
    hidePrompt(chest)
    const { floor, progress } = reward(chest)
    const event = {
      type: 'chestopen',
      chestId: id,
      playerId: String(player.id ?? ''),
      floor,
      chapter: progress.chapter ?? 1,
      roomRole: progress.roomRole ?? 'combat',
    }
    onEvent(event)
    try { openedHandler?.(event) } catch {}
    return { opened: true, chestId: id, event }
  }

  const openNearest = (player) => {
    const chest = nearestInteractable(player?.state, getChests() ?? [], range)
    if (!chest) return { opened: false, reason: 'chest-not-found' }
    if (typeof intentHandler === 'function' && intentHandler(player, chest) === true) {
      return { opened: false, delegated: true, chestId: chest.id }
    }
    return openById(player, chest.id)
  }

  const applyOpenedChestIds = (ids = []) => {
    const next = new Set(
      [...(ids instanceof Set ? ids : Array.isArray(ids) ? ids : [])]
        .map((value) => String(value ?? '').trim())
        .filter(Boolean),
    )
    scene.__dungeonOpenedChestIds = next
    for (const chest of getChests() ?? []) {
      if (!next.has(String(chest?.id ?? '')) || chest?.opened) continue
      openVisual(scene, chest)
      hidePrompt(chest)
    }
    return [...next].sort()
  }

  return {
    openById,
    openNearest,
    applyOpenedChestIds,
    openedChestIds() { return [...openedSet()].filter(Boolean).sort() },
    setIntentHandler(handler = null) {
      const previous = intentHandler
      intentHandler = typeof handler === 'function' ? handler : null
      return previous
    },
    setOpenedHandler(handler = null) {
      const previous = openedHandler
      openedHandler = typeof handler === 'function' ? handler : null
      return previous
    },
    restore() {
      intentHandler = null
      openedHandler = null
    },
  }
}
