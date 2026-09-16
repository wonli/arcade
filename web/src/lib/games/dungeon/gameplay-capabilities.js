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

  const hadLoot = dungeon.loot && typeof dungeon.loot === 'object' ? dungeon.loot : null
  const hadPickup = typeof hadLoot?.pickup === 'function'
  const hadOpenChest = typeof hadLoot?.openChest === 'function'
  dungeon.loot = ensureDungeonLootRuntime(scene)

  if (!hadPickup && typeof scene.__dungeonPickupRuntime?.pickupById === 'function') {
    dungeon.loot.setPickupOwner((player, dropId) => scene.__dungeonPickupRuntime?.pickupById?.(player, dropId))
  }

  if (!hadOpenChest && typeof scene.__dungeonSpatial?.openChestById === 'function') {
    dungeon.loot.setOpenChestOwner((player, chestId) => scene.__dungeonSpatial?.openChestById?.(player, chestId))
  }

  return dungeon
}
