export function healthPotionPickupMode(state = {}) {
  return (state.hp ?? 0) >= (state.maxHp ?? 0) ? 'store' : 'consume'
}

export function useStoredHealthPotion(state = {}, heal = 28) {
  const hp = state.hp ?? 0
  const maxHp = state.maxHp ?? hp
  const healthPotions = state.healthPotions ?? 0
  if (healthPotions <= 0 || hp >= maxHp) return { ...state, hp, maxHp, healthPotions, healed: 0, used: false }
  const nextHp = Math.min(maxHp, hp + heal)
  return { ...state, hp: nextHp, maxHp, healthPotions: healthPotions - 1, healed: nextHp - hp, used: true }
}
