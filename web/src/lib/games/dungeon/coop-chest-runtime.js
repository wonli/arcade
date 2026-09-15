import { rollAffixes } from './affixes.js'
import { chestRewardProfile, nearestInteractable } from './interactables.js'
import { rngFor } from './deterministic-rng.js'

const CHEST_RANGE = 48
const DAMAGE_RANGES = {
  common: [2, 3],
  uncommon: [4, 5],
  rare: [6, 8],
  epic: [9, 12],
}

function clamp01(value) { return Math.max(0, Math.min(0.999999, Number(value) || 0)) }
function rollRange([min, max], random) { return min + Math.floor(clamp01(random()) * (max - min + 1)) }

function rollChestWeapon(profile, floor, random) {
  const roll = clamp01(random())
  let rarity = 'common'
  if (roll < profile.epicChance) rarity = 'epic'
  else if (roll < profile.epicChance + profile.rareChance) rarity = 'rare'
  else if (roll < profile.epicChance + profile.rareChance + profile.uncommonChance) rarity = 'uncommon'
  return {
    type: 'weapon.dungeon_blade',
    rarity,
    damage: rollRange(DAMAGE_RANGES[rarity], random),
    affixes: rollAffixes(floor, rarity, random),
  }
}

export function presentChestOpened(scene, chest) {
  if (!chest || chest.opened) return false
  chest.opened = true
  chest.visuals?.lock?.setVisible?.(false)
  const openFrame = scene.__dungeonEnvironmentOpenFrames?.chest
  if (chest.visuals?.sprite && Number.isInteger(openFrame)) chest.visuals.sprite.setFrame?.(openFrame)
  else if (chest.visuals?.lid) {
    scene.tweens?.add?.({ targets: chest.visuals.lid, y: chest.y - 23, angle: -8, duration: 160, ease: 'Back.Out' })
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

export function applyChestOpened(scene, chestId) {
  const chest = (scene?.__dungeonSpatial?.getChests?.() ?? []).find((entry) => entry?.id === chestId)
  if (!chest) return false
  return presentChestOpened(scene, chest)
}

export function openChestForPlayer(scene, player, {
  runSeed,
  floor = scene?.floor ?? 1,
  progress = {},
} = {}) {
  const state = player?.state ?? player
  if (!scene || !state) return null
  const chest = nearestInteractable(state, scene.__dungeonSpatial?.getChests?.() ?? [], CHEST_RANGE)
  if (!chest || !presentChestOpened(scene, chest)) return null

  const profile = chestRewardProfile(progress.roomRole ?? 'combat', progress.chapter ?? 1, Boolean(progress.fortuneActive))
  const random = rngFor(runSeed, floor, 'chest', chest.id)
  const drops = []
  for (let index = 0; index < profile.dropCount; index++) {
    const item = rollChestWeapon(profile, floor, random)
    const x = chest.x + (index - (profile.dropCount - 1) / 2) * 28
    const y = chest.y + 18
    scene.spawnDrop?.(x, y, item)
    drops.push({ x, y, item })
  }
  return { chest, drops }
}
