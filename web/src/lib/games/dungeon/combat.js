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
  if (random() >= 0.18) return null
  return {
    type: 'weapon.rust_sword',
    rarity: 'uncommon',
    damage: 3,
  }
}

export function applyPickup(player, item) {
  if (!item || item.type !== 'weapon.rust_sword') return { ...player }
  return {
    ...player,
    damage: (player.damage ?? 0) + (item.damage ?? 0),
    weapon: item.type,
  }
}
