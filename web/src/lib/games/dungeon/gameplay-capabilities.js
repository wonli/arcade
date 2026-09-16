import { ensureDungeonCombatRuntime } from './combat-runtime.js'
import { ensureDungeonLootRuntime } from './loot-runtime.js'

function objectOwner(value, label) {
  if (value == null) return {}
  if (typeof value !== 'object') throw new TypeError(`${label} must be an object`)
  return value
}

export function ensureDungeonCapabilities(scene) {
  if (!scene || typeof scene !== 'object') throw new TypeError('Scene is required')

  const dungeon = objectOwner(scene.dungeon, 'scene.dungeon')
  scene.dungeon = dungeon
  dungeon.combat = ensureDungeonCombatRuntime(scene)
  dungeon.loot = ensureDungeonLootRuntime(scene)

  if (!dungeon.loot.hasPickupOwner?.() && typeof scene.__dungeonPickupRuntime?.pickupById === 'function') {
    dungeon.loot.setPickupOwner((player, dropId) => scene.__dungeonPickupRuntime?.pickupById?.(player, dropId))
  }

  if (!dungeon.loot.hasOpenChestOwner?.() && typeof scene.__dungeonSpatial?.openChestById === 'function') {
    dungeon.loot.setOpenChestOwner((player, chestId) => scene.__dungeonSpatial?.openChestById?.(player, chestId))
  }

  return dungeon
}
