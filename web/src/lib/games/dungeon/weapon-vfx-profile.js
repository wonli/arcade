import { weaponDefinition } from './weapon-catalog.js'

const RARITY = {
  common: { particles: null, attack: false, impact: false },
  uncommon: { particles: null, attack: false, impact: false },
  rare: { particles: { frequency: 115, quantity: 1, lifespan: 360, size: 8, burst: 3 }, attack: true, impact: false },
  epic: { particles: { frequency: 78, quantity: 1, lifespan: 460, size: 10, burst: 5 }, attack: true, impact: true },
  legendary: { particles: { frequency: 52, quantity: 2, lifespan: 560, size: 12, burst: 8 }, attack: true, impact: true },
}

const THEMES = {
  steel: { tint: 0xeaf4ff, particle: 'sparkle', sources: ['kenney-particles', 'spell-effects', 'foozle', 'free-pixel-magic'], fallbackKinds: ['aura', 'smoke', 'flame'], attack: 'slash', impact: 'impact' },
  ember: { tint: 0xff8a4c, particle: 'flame', sources: ['foozle', 'spell-effects', 'kenney-particles'], fallbackKinds: ['sparkle', 'aura', 'smoke'], attack: 'slash', impact: 'explosion' },
  frost: { tint: 0x8edfff, particle: 'sparkle', sources: ['kenney-particles', 'spell-effects', 'foozle'], fallbackKinds: ['aura', 'smoke', 'flame'], attack: 'slash', impact: 'sparkle' },
  storm: { tint: 0x9ae9ff, particle: 'lightning', sources: ['lightning', 'kenney-particles', 'spell-effects', 'foozle', 'free-pixel-magic'], fallbackKinds: ['sparkle', 'aura', 'flame'], attack: 'lightning', impact: 'impact' },
  arcane: { tint: 0xc984ff, particle: 'aura', sources: ['spell-effects', 'foozle', 'kenney-particles'], fallbackKinds: ['sparkle', 'smoke', 'flame'], attack: 'beam', impact: 'sparkle' },
  blood: { tint: 0xff6470, particle: 'smoke', sources: ['retro-impact', 'foozle', 'spell-effects', 'kenney-particles'], fallbackKinds: ['sparkle', 'aura', 'flame'], attack: 'slash', impact: 'critical' },
}

const ARCHETYPE_MOTION = {
  dagger: { speed: [10, 24], lifespanMultiplier: 0.84 },
  sword: { speed: [6, 18], lifespanMultiplier: 1 },
  katana: { speed: [12, 28], lifespanMultiplier: 1.08 },
  axe: { speed: [4, 15], lifespanMultiplier: 0.95 },
  spear: { speed: [8, 22], lifespanMultiplier: 0.96 },
  greatsword: { speed: [3, 12], lifespanMultiplier: 1.16 },
  bow: { speed: [12, 26], lifespanMultiplier: 0.88 },
  staff: { speed: [4, 14], lifespanMultiplier: 1.14 },
}

function weaponIdentity(item = {}) {
  const definition = weaponDefinition(item?.type ?? item?.id)
  const requestedTheme = item?.vfxTheme ?? item?.theme ?? definition?.vfxTheme
  const theme = THEMES[requestedTheme] ? requestedTheme : 'steel'
  const archetype = item?.archetype ?? definition?.archetype ?? 'sword'
  const variant = Number.isInteger(item?.vfxVariant)
    ? item.vfxVariant
    : Number.isInteger(definition?.vfxVariant) ? definition.vfxVariant : 0
  return { theme, archetype, variant }
}

export function weaponVfxTheme(item = {}) { return weaponIdentity(item).theme }

export function weaponVfxProfile(item = {}) {
  const rarity = RARITY[item?.rarity] ? item.rarity : 'common'
  const { theme, archetype, variant } = weaponIdentity(item)
  const rarityProfile = RARITY[rarity]
  const themeProfile = THEMES[theme]
  const motion = ARCHETYPE_MOTION[archetype] ?? ARCHETYPE_MOTION.sword
  return {
    rarity,
    theme,
    archetype,
    variant,
    tint: themeProfile.tint,
    particles: rarityProfile.particles
      ? {
          kind: themeProfile.particle,
          source: themeProfile.sources[0],
          sources: [...themeProfile.sources],
          fallbackKinds: [...themeProfile.fallbackKinds],
          variant,
          tint: themeProfile.tint,
          speed: [...motion.speed],
          ...rarityProfile.particles,
          lifespan: Math.round(rarityProfile.particles.lifespan * motion.lifespanMultiplier),
        }
      : null,
    attack: rarityProfile.attack ? { kind: themeProfile.attack } : null,
    impact: rarityProfile.impact ? { kind: themeProfile.impact } : null,
  }
}
