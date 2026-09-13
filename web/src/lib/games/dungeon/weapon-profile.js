const PROFILES = {
  dagger: {
    archetype: 'dagger',
    intervalMultiplier: 0.76,
    range: 132,
    damageMultiplier: 0.88,
    knockbackMultiplier: 0.72,
    swingMs: 105,
    visualScale: 0.9,
    reachScale: 0.78,
  },
  sword: {
    archetype: 'sword',
    intervalMultiplier: 1,
    range: 165,
    damageMultiplier: 1,
    knockbackMultiplier: 1,
    swingMs: 150,
    visualScale: 1,
    reachScale: 1,
  },
  katana: {
    archetype: 'katana',
    intervalMultiplier: 1.18,
    range: 196,
    damageMultiplier: 1.14,
    knockbackMultiplier: 1.16,
    swingMs: 185,
    visualScale: 1.08,
    reachScale: 1.22,
  },
}

export function weaponArchetype(itemOrPlayer = null) {
  const source = itemOrPlayer?.equippedWeapon ?? itemOrPlayer
  const archetype = source?.archetype ?? source?.weaponArchetype
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
