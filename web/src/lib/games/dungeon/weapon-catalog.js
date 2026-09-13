export const WEAPON_CATALOG = Object.freeze([
  { id: 'iron_fang', name: 'Iron Fang', type: 'weapon.iron_fang', archetype: 'dagger', vfxTheme: 'steel', minFloor: 1 },
  { id: 'warden_blade', name: 'Warden Blade', type: 'weapon.warden_blade', archetype: 'sword', vfxTheme: 'steel', minFloor: 1 },
  { id: 'ash_saber', name: 'Ash Saber', type: 'weapon.ash_saber', archetype: 'katana', vfxTheme: 'ember', minFloor: 1 },
  { id: 'grave_cleaver', name: 'Grave Cleaver', type: 'weapon.grave_cleaver', archetype: 'axe', vfxTheme: 'blood', minFloor: 2 },
  { id: 'frostbite', name: 'Frostbite', type: 'weapon.frostbite', archetype: 'dagger', vfxTheme: 'frost', minFloor: 2 },
  { id: 'storm_lance', name: 'Storm Lance', type: 'weapon.storm_lance', archetype: 'spear', vfxTheme: 'storm', minFloor: 3 },
  { id: 'ember_maul', name: 'Ember Maul', type: 'weapon.ember_maul', archetype: 'greatsword', vfxTheme: 'ember', minFloor: 3 },
  { id: 'void_edge', name: 'Void Edge', type: 'weapon.void_edge', archetype: 'katana', vfxTheme: 'arcane', minFloor: 4 },
  { id: 'blood_reaver', name: 'Blood Reaver', type: 'weapon.blood_reaver', archetype: 'greatsword', vfxTheme: 'blood', minFloor: 4 },
  { id: 'arcane_spire', name: 'Arcane Spire', type: 'weapon.arcane_spire', archetype: 'staff', vfxTheme: 'arcane', minFloor: 5 },
  { id: 'tempest_bow', name: 'Tempest Bow', type: 'weapon.tempest_bow', archetype: 'bow', vfxTheme: 'storm', minFloor: 5 },
  { id: 'starfall_spear', name: 'Starfall Spear', type: 'weapon.starfall_spear', archetype: 'spear', vfxTheme: 'arcane', minFloor: 6 },
])

export function weaponDefinition(idOrType) {
  return WEAPON_CATALOG.find((weapon) => weapon.id === idOrType || weapon.type === idOrType) ?? null
}

export function availableWeapons(floor = 1) {
  const level = Math.max(1, Math.floor(floor || 1))
  return WEAPON_CATALOG.filter((weapon) => weapon.minFloor <= level)
}

export function rollWeaponDefinition(floor = 1, random = Math.random) {
  const pool = availableWeapons(floor)
  if (!pool.length) return WEAPON_CATALOG[0] ?? null
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
    affixes: [...(item.affixes ?? [])],
  }
}
