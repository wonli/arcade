export const DEFAULT_PLAYER_STATS = Object.freeze({
  damage: 10,
  critChance: 0.18,
  speed: 190,
  maxHp: 100,
})

export function createDefaultPlayerState(overrides = {}) {
  const baseStats = {
    ...DEFAULT_PLAYER_STATS,
    ...(overrides.baseStats ?? {}),
  }
  const state = {
    hp: baseStats.maxHp,
    ...baseStats,
    baseStats,
    critMultiplier: 2,
    equipment: { weapon: null },
    modifiers: {},
    hasteUntil: 0,
    healthPotions: 0,
    ...overrides,
  }

  return {
    ...state,
    baseStats,
    equipment: state.equipment ?? { weapon: null },
    modifiers: state.modifiers ?? {},
  }
}
