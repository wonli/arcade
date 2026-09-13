const RARITY = {
  common: { idleDelay: 0, idleAlpha: 0, attack: false, impact: false },
  uncommon: { idleDelay: 1150, idleAlpha: 0.45, attack: false, impact: false },
  rare: { idleDelay: 820, idleAlpha: 0.58, attack: true, impact: false },
  epic: { idleDelay: 560, idleAlpha: 0.72, attack: true, impact: true },
  legendary: { idleDelay: 360, idleAlpha: 0.86, attack: true, impact: true },
}

const THEMES = {
  steel: { tint: 0xeaf4ff, idle: 'sparkle', attack: 'slash', impact: 'impact' },
  ember: { tint: 0xff8a4c, idle: 'flame', attack: 'slash', impact: 'explosion' },
  frost: { tint: 0x8edfff, idle: 'sparkle', attack: 'slash', impact: 'sparkle' },
  storm: { tint: 0x9ae9ff, idle: 'sparkle', attack: 'lightning', impact: 'impact' },
  arcane: { tint: 0xc984ff, idle: 'aura', attack: 'beam', impact: 'sparkle' },
  blood: { tint: 0xff6470, idle: 'smoke', attack: 'slash', impact: 'critical' },
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
    idle: rarityProfile.idleDelay > 0 ? { kind: themeProfile.idle, delay: rarityProfile.idleDelay, alpha: rarityProfile.idleAlpha } : null,
    attack: rarityProfile.attack ? { kind: themeProfile.attack, alpha: Math.min(1, rarityProfile.idleAlpha + 0.16) } : null,
    impact: rarityProfile.impact ? { kind: themeProfile.impact, alpha: Math.min(1, rarityProfile.idleAlpha + 0.12) } : null,
  }
}
