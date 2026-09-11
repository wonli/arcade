export function nearestTarget(player, enemies) {
  let best = null
  let bestDistance = Infinity
  for (const enemy of enemies) {
    if (!enemy || enemy.hp <= 0) continue
    const dx = enemy.x - player.x
    const dy = enemy.y - player.y
    const distance = dx * dx + dy * dy
    if (distance < bestDistance) {
      best = enemy
      bestDistance = distance
    }
  }
  return best
}

export function rollDamage(player, random = Math.random) {
  const critical = random() < (player.critChance ?? 0)
  const multiplier = critical ? (player.critMultiplier ?? 2) : 1
  return {
    damage: Math.round((player.damage ?? 1) * multiplier),
    critical,
  }
}

export function rollDrop(_floor, random = Math.random) {
  const roll = random()
  if (roll < 0.18) {
    return {
      type: 'weapon.rust_sword',
      rarity: 'uncommon',
      damage: 3,
    }
  }
  if (roll < 0.30) {
    return {
      type: 'consumable.health_potion',
      rarity: 'common',
      heal: 28,
    }
  }
  return null
}

export function applyPickup(player, item) {
  if (!item) return { ...player }
  if (item.type === 'weapon.rust_sword') {
    return {
      ...player,
      damage: (player.damage ?? 0) + (item.damage ?? 0),
      weapon: item.type,
    }
  }
  if (item.type === 'consumable.health_potion') {
    const maxHp = player.maxHp ?? player.hp ?? 0
    return {
      ...player,
      hp: Math.min(maxHp, (player.hp ?? 0) + (item.heal ?? 0)),
    }
  }
  return { ...player }
}
