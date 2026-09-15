import { currentWeapon } from './player-loadout.js'

const PROFILES = {
  dagger: {
    archetype: 'dagger', attackMode: 'melee', intervalMultiplier: 0.76, range: 132,
    damageMultiplier: 0.88, knockbackMultiplier: 0.72, swingMs: 105, visualScale: 0.9, reachScale: 0.78,
  },
  sword: {
    archetype: 'sword', attackMode: 'melee', intervalMultiplier: 1, range: 165,
    damageMultiplier: 1, knockbackMultiplier: 1, swingMs: 150, visualScale: 1, reachScale: 1,
  },
  katana: {
    archetype: 'katana', attackMode: 'melee', intervalMultiplier: 1.18, range: 196,
    damageMultiplier: 1.14, knockbackMultiplier: 1.16, swingMs: 185, visualScale: 1.08, reachScale: 1.22,
  },
  greatsword: {
    archetype: 'greatsword', attackMode: 'melee', intervalMultiplier: 1.42, range: 188,
    damageMultiplier: 1.34, knockbackMultiplier: 1.42, swingMs: 230, visualScale: 1.2, reachScale: 1.18,
  },
  spear: {
    archetype: 'spear', attackMode: 'melee', intervalMultiplier: 1.08, range: 228,
    damageMultiplier: 1.04, knockbackMultiplier: 1.05, swingMs: 165, visualScale: 1.14, reachScale: 1.5,
  },
  axe: {
    archetype: 'axe', attackMode: 'melee', intervalMultiplier: 1.28, range: 168,
    damageMultiplier: 1.22, knockbackMultiplier: 1.55, swingMs: 205, visualScale: 1.12, reachScale: 1.04,
  },
  bow: {
    archetype: 'bow', attackMode: 'ranged', intervalMultiplier: 1.16, range: 315,
    damageMultiplier: 0.98, knockbackMultiplier: 0.5, swingMs: 150, visualScale: 1, reachScale: 1.1,
  },
  staff: {
    archetype: 'staff', attackMode: 'ranged', intervalMultiplier: 1.34, range: 285,
    damageMultiplier: 1.12, knockbackMultiplier: 0.72, swingMs: 190, visualScale: 1.08, reachScale: 1.25,
  },
}

export function weaponArchetype(itemOrPlayer = null) {
  const source = itemOrPlayer?.equipment ? currentWeapon(itemOrPlayer) : itemOrPlayer
  const archetype = source?.archetype
  return PROFILES[archetype] ? archetype : 'sword'
}

export function weaponProfile(itemOrPlayer = null) {
  return PROFILES[weaponArchetype(itemOrPlayer)]
}

export function weaponAttackDamage(player, damage) {
  return Math.max(1, Math.round(damage * weaponProfile(player).damageMultiplier))
}

export function weaponAttackKnockback(player, knockback) {
  return knockback * weaponProfile(player).knockbackMultiplier
}
