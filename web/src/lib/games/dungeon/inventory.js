export const AUTO_POTION_THRESHOLD = 0.30
export const HEALTH_POTION_HEAL_RATIO = 0.30

export function shouldAutoUseHealthPotion(state = {}, threshold = AUTO_POTION_THRESHOLD) {
  const hp = Number(state.hp ?? 0)
  const maxHp = Number(state.maxHp ?? 0)
  const healthPotions = Number(state.healthPotions ?? 0)
  return hp > 0 && maxHp > 0 && healthPotions > 0 && hp / maxHp <= threshold
}

export function healthPotionPickupMode(state = {}) {
  return shouldAutoUseHealthPotion(state) ? 'consume' : 'store'
}

export function useStoredHealthPotion(state = {}, healRatio = HEALTH_POTION_HEAL_RATIO) {
  const hp = Number(state.hp ?? 0)
  const maxHp = Number(state.maxHp ?? hp)
  const healthPotions = Number(state.healthPotions ?? 0)
  if (healthPotions <= 0 || hp <= 0 || hp >= maxHp) {
    return { ...state, hp, maxHp, healthPotions, healed: 0, used: false }
  }
  const heal = Math.max(1, Math.round(maxHp * Math.max(0, healRatio)))
  const nextHp = Math.min(maxHp, hp + heal)
  return {
    ...state,
    hp: nextHp,
    maxHp,
    healthPotions: healthPotions - 1,
    healed: nextHp - hp,
    used: true,
  }
}
