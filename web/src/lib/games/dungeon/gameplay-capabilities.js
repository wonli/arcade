function objectOwner(value, label) {
  if (value == null) return {}
  if (typeof value !== 'object') throw new TypeError(`${label} must be an object`)
  return value
}

export function ensureDungeonCapabilities(scene) {
  if (!scene || typeof scene !== 'object') throw new TypeError('Scene is required')

  const dungeon = objectOwner(scene.dungeon, 'scene.dungeon')
  scene.dungeon = dungeon

  const combat = objectOwner(dungeon.combat, 'scene.dungeon.combat')
  const loot = objectOwner(dungeon.loot, 'scene.dungeon.loot')
  dungeon.combat = combat
  dungeon.loot = loot

  if (typeof combat.attack !== 'function' && typeof scene.autoAttack === 'function') {
    combat.attack = (player, time) => scene.autoAttack(time, player)
  }

  if (typeof loot.pickup !== 'function' && typeof scene.__dungeonPickupRuntime?.pickupById === 'function') {
    loot.pickup = (player, dropId) => scene.__dungeonPickupRuntime?.pickupById?.(player, dropId)
  }

  if (typeof loot.openChest !== 'function' && typeof scene.__dungeonSpatial?.openChestById === 'function') {
    loot.openChest = (player, chestId) => scene.__dungeonSpatial?.openChestById?.(player, chestId)
  }

  return dungeon
}
