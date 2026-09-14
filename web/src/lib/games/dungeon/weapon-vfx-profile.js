const RARITY = {
  common: { particles: null, attack: false, impact: false },
  uncommon: { particles: null, attack: false, impact: false },
  rare: { particles: { frequency: 115, quantity: 1, lifespan: 360, scale: 0.12, burst: 3 }, attack: true, impact: false },
  epic: { particles: { frequency: 78, quantity: 1, lifespan: 460, scale: 0.16, burst: 5 }, attack: true, impact: true },
  legendary: { particles: { frequency: 52, quantity: 2, lifespan: 560, scale: 0.2, burst: 8 }, attack: true, impact: true },
}

const THEMES = {
  steel: { tint: 0xeaf4ff, particle: 'sparkle', attack: 'slash', impact: 'impact' },
  ember: { tint: 0xff8a4c, particle: 'flame', attack: 'slash', impact: 'explosion' },
  frost: { tint: 0x8edfff, particle: 'sparkle', attack: 'slash', impact: 'sparkle' },
  storm: { tint: 0x9ae9ff, particle: 'sparkle', attack: 'lightning', impact: 'impact' },
  arcane: { tint: 0xc984ff, particle: 'aura', attack: 'beam', impact: 'sparkle' },
  blood: { tint: 0xff6470, particle: 'smoke', attack: 'slash', impact: 'critical' },
}

export function weaponVfxTheme(item = {}) {
  const requested = item?.vfxTheme ?? item?.theme
  return THEMES[requested] ? requested : 'steel'
}

export function weaponVfxProfile(item = {}) {
  const rarity = RARITY[item?.rarity] ? item.rarity : 'common'
  const theme = weaponVfxTheme(item)
  const rarityProfile = RARITY[rarity]
  const themeProfile = THEMES[theme]
  return {
    rarity,
    theme,
    tint: themeProfile.tint,
    particles: rarityProfile.particles
      ? { source: 'kenney-particles', kind: themeProfile.particle, ...rarityProfile.particles }
      : null,
    attack: rarityProfile.attack ? { kind: themeProfile.attack } : null,
    impact: rarityProfile.impact ? { kind: themeProfile.impact } : null,
  }
}
