import { LEGENDARY_WEAPON_CATALOG, rollBossLegendary } from './legendary-weapons.js'

const STANDARD_WEAPON_CATALOG = Object.freeze([
  { id: 'iron_fang', name: 'Iron Fang', type: 'weapon.iron_fang', archetype: 'dagger', vfxTheme: 'steel', vfxVariant: 0, minFloor: 1 },
  { id: 'warden_blade', name: 'Warden Blade', type: 'weapon.warden_blade', archetype: 'sword', vfxTheme: 'steel', vfxVariant: 1, minFloor: 1 },
  { id: 'ash_saber', name: 'Ash Saber', type: 'weapon.ash_saber', archetype: 'katana', vfxTheme: 'ember', vfxVariant: 0, minFloor: 1 },
  { id: 'grave_cleaver', name: 'Grave Cleaver', type: 'weapon.grave_cleaver', archetype: 'axe', vfxTheme: 'blood', vfxVariant: 0, minFloor: 2 },
  { id: 'frostbite', name: 'Frostbite', type: 'weapon.frostbite', archetype: 'dagger', vfxTheme: 'frost', vfxVariant: 0, minFloor: 2 },
  { id: 'storm_lance', name: 'Storm Lance', type: 'weapon.storm_lance', archetype: 'spear', vfxTheme: 'storm', vfxVariant: 0, minFloor: 3 },
  { id: 'ember_maul', name: 'Ember Maul', type: 'weapon.ember_maul', archetype: 'greatsword', vfxTheme: 'ember', vfxVariant: 1, minFloor: 3 },
  { id: 'void_edge', name: 'Void Edge', type: 'weapon.void_edge', archetype: 'katana', vfxTheme: 'arcane', vfxVariant: 0, minFloor: 4 },
  { id: 'blood_reaver', name: 'Blood Reaver', type: 'weapon.blood_reaver', archetype: 'greatsword', vfxTheme: 'blood', vfxVariant: 1, minFloor: 4 },
  { id: 'arcane_spire', name: 'Arcane Spire', type: 'weapon.arcane_spire', archetype: 'staff', vfxTheme: 'arcane', vfxVariant: 1, minFloor: 1 },
  { id: 'tempest_bow', name: 'Tempest Bow', type: 'weapon.tempest_bow', archetype: 'bow', vfxTheme: 'storm', vfxVariant: 1, minFloor: 1 },
  { id: 'starfall_spear', name: 'Starfall Spear', type: 'weapon.starfall_spear', archetype: 'spear', vfxTheme: 'arcane', vfxVariant: 2, minFloor: 6 },
])

export { LEGENDARY_WEAPON_CATALOG, rollBossLegendary }

export const WEAPON_CATALOG = Object.freeze([
  ...STANDARD_WEAPON_CATALOG,
  ...LEGENDARY_WEAPON_CATALOG,
])

export function weaponDefinition(idOrType) {
  return WEAPON_CATALOG.find((weapon) => weapon.id === idOrType || weapon.type === idOrType) ?? null
}

export function availableWeapons(floor = 1) {
  const level = Math.max(1, Math.floor(floor || 1))
  return STANDARD_WEAPON_CATALOG.filter((weapon) => weapon.minFloor <= level)
}

export function rollWeaponDefinition(floor = 1, random = Math.random, archetype = null) {
  const available = availableWeapons(floor)
  const matching = archetype ? available.filter((weapon) => weapon.archetype === archetype) : []
  const pool = matching.length ? matching : available
  if (!pool.length) return STANDARD_WEAPON_CATALOG[0] ?? null
  const roll = Math.max(0, Math.min(0.999999, random()))
  return pool[Math.floor(roll * pool.length)] ?? pool[0]
}

export function materializeWeapon(definition, item = {}) {
  if (!definition) return item ? { ...item, affixes: [...(item.affixes ?? [])] } : null
  return {
    ...item,
    id: definition.id,
    name: definition.name,
    type: definition.type,
    archetype: definition.archetype,
    vfxTheme: definition.vfxTheme,
    vfxVariant: definition.vfxVariant,
    affixes: [...(item.affixes ?? [])],
  }
}
