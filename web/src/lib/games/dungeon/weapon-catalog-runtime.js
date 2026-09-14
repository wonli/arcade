import { specializeWeaponAffixes } from './affixes.js'
import { materializeWeapon, rollWeaponDefinition, weaponDefinition } from './weapon-catalog.js'

export function weaponizeDrop(item, floor = 1, random = Math.random) {
  if (!item?.type?.startsWith?.('weapon.')) return item
  if (weaponDefinition(item.type)) return specializeWeaponAffixes({ ...item, affixes: [...(item.affixes ?? [])] })
  const definition = rollWeaponDefinition(floor, random)
  return specializeWeaponAffixes(materializeWeapon(definition, item))
}

export function installDungeonWeaponCatalog(scene, { random = Math.random } = {}) {
  if (!scene || scene.__dungeonWeaponCatalog) return scene?.__dungeonWeaponCatalog ?? null
  const originalSpawnDrop = scene.spawnDrop?.bind(scene)
  if (!originalSpawnDrop) return null

  scene.spawnDrop = function spawnCatalogWeapon(x, y, item) {
    return originalSpawnDrop(x, y, weaponizeDrop(item, scene.floor ?? 1, random))
  }

  const restore = () => {
    scene.spawnDrop = originalSpawnDrop
    scene.__dungeonWeaponCatalog = null
  }
  scene.events?.once?.('shutdown', restore)
  scene.events?.once?.('destroy', restore)

  const api = { restore }
  scene.__dungeonWeaponCatalog = api
  return api
}
