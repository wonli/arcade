const ROOT = './assets/Weapons Asset 16x16'

const NUMBERS = Object.freeze({
  'weapon.iron_fang': '017',
  'weapon.warden_blade': '004',
  'weapon.ash_saber': '101',
  'weapon.grave_cleaver': '034',
  'weapon.frostbite': '020',
  'weapon.storm_lance': '087',
  'weapon.ember_maul': '094',
  'weapon.void_edge': '103',
  'weapon.blood_reaver': '095',
  'weapon.arcane_spire': '060',
  'weapon.tempest_bow': '106',
  'weapon.starfall_spear': '090',
})

export function namedWeaponArt(type) {
  const number = NUMBERS[type]
  if (!number) return null
  return {
    number,
    base: `${ROOT}/${number}.png`,
    selected: `${ROOT}/Selected Version/${number}.png`,
  }
}

export function namedWeaponArtEntries() {
  return Object.entries(NUMBERS).map(([type, number]) => ({
    type,
    number,
    base: `${ROOT}/${number}.png`,
    selected: `${ROOT}/Selected Version/${number}.png`,
  }))
}
