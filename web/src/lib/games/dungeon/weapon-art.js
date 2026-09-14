const ART = Object.freeze({
  'weapon.iron_fang': { number: '017', base: new URL('./assets/Weapons Asset 16x16/017.png', import.meta.url).href, selected: new URL('./assets/Weapons Asset 16x16/Selected Version/017.png', import.meta.url).href },
  'weapon.warden_blade': { number: '004', base: new URL('./assets/Weapons Asset 16x16/004.png', import.meta.url).href, selected: new URL('./assets/Weapons Asset 16x16/Selected Version/004.png', import.meta.url).href },
  'weapon.ash_saber': { number: '101', base: new URL('./assets/Weapons Asset 16x16/101.png', import.meta.url).href, selected: new URL('./assets/Weapons Asset 16x16/Selected Version/101.png', import.meta.url).href },
  'weapon.grave_cleaver': { number: '034', base: new URL('./assets/Weapons Asset 16x16/034.png', import.meta.url).href, selected: new URL('./assets/Weapons Asset 16x16/Selected Version/034.png', import.meta.url).href },
  'weapon.frostbite': { number: '020', base: new URL('./assets/Weapons Asset 16x16/020.png', import.meta.url).href, selected: new URL('./assets/Weapons Asset 16x16/Selected Version/020.png', import.meta.url).href },
  'weapon.storm_lance': { number: '087', base: new URL('./assets/Weapons Asset 16x16/087.png', import.meta.url).href, selected: new URL('./assets/Weapons Asset 16x16/Selected Version/087.png', import.meta.url).href },
  'weapon.ember_maul': { number: '094', base: new URL('./assets/Weapons Asset 16x16/094.png', import.meta.url).href, selected: new URL('./assets/Weapons Asset 16x16/Selected Version/094.png', import.meta.url).href },
  'weapon.void_edge': { number: '103', base: new URL('./assets/Weapons Asset 16x16/103.png', import.meta.url).href, selected: new URL('./assets/Weapons Asset 16x16/Selected Version/103.png', import.meta.url).href },
  'weapon.blood_reaver': { number: '095', base: new URL('./assets/Weapons Asset 16x16/095.png', import.meta.url).href, selected: new URL('./assets/Weapons Asset 16x16/Selected Version/095.png', import.meta.url).href },
  'weapon.arcane_spire': { number: '060', base: new URL('./assets/Weapons Asset 16x16/060.png', import.meta.url).href, selected: new URL('./assets/Weapons Asset 16x16/Selected Version/060.png', import.meta.url).href },
  'weapon.tempest_bow': { number: '106', base: new URL('./assets/Weapons Asset 16x16/106.png', import.meta.url).href, selected: new URL('./assets/Weapons Asset 16x16/Selected Version/106.png', import.meta.url).href },
  'weapon.starfall_spear': { number: '090', base: new URL('./assets/Weapons Asset 16x16/090.png', import.meta.url).href, selected: new URL('./assets/Weapons Asset 16x16/Selected Version/090.png', import.meta.url).href },
  'weapon.kings_ruin': { number: 'sword-11', base: new URL('./assets/sword-7soul1_20201212/32x32/sword_11.png', import.meta.url).href, selected: new URL('./assets/sword-7soul1_20201212/32x32/sword_11.png', import.meta.url).href, displayScale: 1 },
  'weapon.sunfall': { number: 'sword-12', base: new URL('./assets/sword-7soul1_20201212/32x32/sword_12.png', import.meta.url).href, selected: new URL('./assets/sword-7soul1_20201212/32x32/sword_12.png', import.meta.url).href, displayScale: 1 },
  'weapon.white_silence': { number: 'sword-13', base: new URL('./assets/sword-7soul1_20201212/32x32/sword_13.png', import.meta.url).href, selected: new URL('./assets/sword-7soul1_20201212/32x32/sword_13.png', import.meta.url).href, displayScale: 1 },
  'weapon.stormcrown': { number: 'sword-14', base: new URL('./assets/sword-7soul1_20201212/32x32/sword_14.png', import.meta.url).href, selected: new URL('./assets/sword-7soul1_20201212/32x32/sword_14.png', import.meta.url).href, displayScale: 1 },
  'weapon.void_testament': { number: 'sword-15', base: new URL('./assets/sword-7soul1_20201212/32x32/sword_15.png', import.meta.url).href, selected: new URL('./assets/sword-7soul1_20201212/32x32/sword_15.png', import.meta.url).href, displayScale: 1 },
  'weapon.blood_oath': { number: 'sword-16', base: new URL('./assets/sword-7soul1_20201212/32x32/sword_16.png', import.meta.url).href, selected: new URL('./assets/sword-7soul1_20201212/32x32/sword_16.png', import.meta.url).href, displayScale: 1 },
  'weapon.dawn_reaver': { number: 'sword-17', base: new URL('./assets/sword-7soul1_20201212/32x32/sword_17.png', import.meta.url).href, selected: new URL('./assets/sword-7soul1_20201212/32x32/sword_17.png', import.meta.url).href, displayScale: 1 },
  'weapon.cinder_vow': { number: 'sword-18', base: new URL('./assets/sword-7soul1_20201212/32x32/sword_18.png', import.meta.url).href, selected: new URL('./assets/sword-7soul1_20201212/32x32/sword_18.png', import.meta.url).href, displayScale: 1 },
  'weapon.winters_end': { number: 'sword-19', base: new URL('./assets/sword-7soul1_20201212/32x32/sword_19.png', import.meta.url).href, selected: new URL('./assets/sword-7soul1_20201212/32x32/sword_19.png', import.meta.url).href, displayScale: 1 },
  'weapon.thunderwake': { number: 'sword-20', base: new URL('./assets/sword-7soul1_20201212/32x32/sword_20.png', import.meta.url).href, selected: new URL('./assets/sword-7soul1_20201212/32x32/sword_20.png', import.meta.url).href, displayScale: 1 },
  'weapon.starless_edge': { number: 'sword-21', base: new URL('./assets/sword-7soul1_20201212/32x32/sword_21.png', import.meta.url).href, selected: new URL('./assets/sword-7soul1_20201212/32x32/sword_21.png', import.meta.url).href, displayScale: 1 },
  'weapon.crimson_verdict': { number: 'sword-22', base: new URL('./assets/sword-7soul1_20201212/32x32/sword_22.png', import.meta.url).href, selected: new URL('./assets/sword-7soul1_20201212/32x32/sword_22.png', import.meta.url).href, displayScale: 1 },
})

export function namedWeaponArt(type) {
  return ART[type] ?? null
}

export function namedWeaponArtEntries() {
  return Object.entries(ART).map(([type, art]) => ({ type, ...art }))
}
