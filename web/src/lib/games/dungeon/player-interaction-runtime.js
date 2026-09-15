import { rollAffixes } from './affixes.js'
import { chestRewardProfile, nearestInteractable } from './interactables.js'

const CHEST_RANGE = 48
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

function openChestPresentation(scene, chest) {
  if (!chest || chest.opened) return false
  chest.opened = true
  chest.visuals?.lock?.setVisible?.(false)

  const openFrame = scene.__dungeonEnvironmentOpenFrames?.chest
  if (chest.visuals?.sprite && Number.isInteger(openFrame)) {
    chest.visuals.sprite.setFrame?.(openFrame)
  } else if (chest.visuals?.lid) {
    scene.tweens?.add?.({
      targets: chest.visuals.lid,
      y: chest.y - 23,
      angle: -8,
      duration: 160,
      ease: 'Back.Out',
    })
  }

  if (chest.visuals?.glow) {
    scene.tweens?.add?.({
      targets: chest.visuals.glow,
      alpha: 0.55,
      scale: 1.7,
      duration: 220,
      yoyo: true,
      onComplete: () => chest.visuals.glow?.setAlpha?.(0.08),
    })
  }
  scene.__dungeonVfx?.sparkle?.(chest.x, chest.y - 22, { width: 52, height: 52, depth: 28 })
  return true
}

export function installDungeonPlayerInteractions(scene, {
  getProgress = () => ({ floor: scene?.floor ?? 1, chapter: 1, roomRole: 'combat', fortuneActive: false }),
  onEvent = () => {},
  random = Math.random,
} = {}) {
  if (!scene || scene.__dungeonPlayerInteractions) return scene?.__dungeonPlayerInteractions ?? null

  const chests = () => scene.__dungeonSpatial?.getChests?.() ?? []

  const interactPlayer = (player) => {
    const state = player?.state ?? player
    if (!state) return false
    const chest = nearestInteractable(state, chests(), CHEST_RANGE)
    if (!chest || !openChestPresentation(scene, chest)) return false

    const progress = getProgress() ?? {}
    const profile = chestRewardProfile(
      progress.roomRole ?? 'combat',
      progress.chapter ?? 1,
      Boolean(progress.fortuneActive),
    )
    const floor = progress.floor ?? scene.floor ?? 1
    onEvent({
      type: 'chestopen',
      floor,
      chapter: progress.chapter ?? 1,
      roomRole: progress.roomRole ?? 'combat',
      playerId: player?.id ?? null,
    })
    scene.time?.delayedCall?.(90, () => {
      for (let index = 0; index < profile.dropCount; index++) {
        scene.spawnDrop?.(
          chest.x + (index - (profile.dropCount - 1) / 2) * 28,
          chest.y + 18,
          rollChestWeapon(profile, floor, random),
        )
      }
    })
    return true
  }

  const applySnapshot = (authoritative = []) => {
    const byId = new Map(authoritative.filter(Boolean).map((entry) => [entry.id, entry]))
    for (const chest of chests()) {
      const next = byId.get(chest.id)
      if (next?.opened && !chest.opened) openChestPresentation(scene, chest)
    }
  }

  const api = { interactPlayer, applySnapshot }
  scene.__dungeonPlayerInteractions = api
  scene.events?.once?.('shutdown', () => {
    if (scene.__dungeonPlayerInteractions === api) scene.__dungeonPlayerInteractions = null
  })
  return api
}
