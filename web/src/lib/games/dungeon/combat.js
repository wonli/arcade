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

const EQUIPMENT_TABLES = {
  1: [0.12, 0.20, 0.225, 0.23],
  2: [0.11, 0.19, 0.225, 0.235],
  3: [0.10, 0.18, 0.225, 0.24],
  4: [0.09, 0.17, 0.22, 0.245],
  5: [0.08, 0.15, 0.20, 0.25],
}

const DAMAGE_RANGES = {
  common: [2, 3],
  uncommon: [4, 5],
  rare: [6, 8],
  epic: [9, 12],
}

function damageForRarity(rarity, roll) {
  const [min, max] = DAMAGE_RANGES[rarity]
  const normalized = Math.max(0, Math.min(0.999999, roll))
  return min + Math.floor(normalized * (max - min + 1))
}

export function rollEquipment(floor, random = Math.random) {
  const level = Math.max(1, Math.min(5, Math.floor(floor || 1)))
  const roll = random()
  const [commonEnd, uncommonEnd, rareEnd, epicEnd] = EQUIPMENT_TABLES[level]
  let rarity = null
  if (roll < commonEnd) rarity = 'common'
  else if (roll < uncommonEnd) rarity = 'uncommon'
  else if (roll < rareEnd) rarity = 'rare'
  else if (roll < epicEnd) rarity = 'epic'
  if (!rarity) return null
  return {
    type: 'weapon.dungeon_blade',
    rarity,
    damage: damageForRarity(rarity, roll * 7.31),
  }
}

export function rollPotion(random = Math.random) {
  if (random() >= 0.12) return null
  return {
    type: 'consumable.health_potion',
    rarity: 'common',
    heal: 28,
  }
}

export function enemyArchetype(floor, random = Math.random, { elite = false } = {}) {
  if (elite) {
    return {
      type: 'brute',
      hpMultiplier: 2.8 + Math.max(0, floor - 1) * 0.08,
      speedMultiplier: 0.72,
      scale: 1.35,
      contactDamage: 18,
      elite: true,
    }
  }
  const roll = random()
  if (roll < 0.5) {
    return { type: 'skeleton', hpMultiplier: 1, speedMultiplier: 1, scale: 1, contactDamage: 10, elite: false }
  }
  if (roll < 0.78) {
    return { type: 'fast', hpMultiplier: 0.65, speedMultiplier: 1.55, scale: 0.9, contactDamage: 8, elite: false }
  }
  return { type: 'brute', hpMultiplier: 1.75, speedMultiplier: 0.72, scale: 1.2, contactDamage: 14, elite: false }
}

export function floorWave(floor) {
  const level = Math.max(1, Math.min(5, Math.floor(floor || 1)))
  return {
    count: 10 + level * 2,
    eliteCount: level === 5 ? 1 : 0,
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
  if (item.type?.startsWith('weapon.')) {
    return {
      ...player,
      damage: (player.damage ?? 0) + (item.damage ?? 0),
      weapon: item.type,
      weaponRarity: item.rarity ?? player.weaponRarity ?? null,
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
