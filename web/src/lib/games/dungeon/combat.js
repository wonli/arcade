import { deriveEquipment, rollAffixes } from './affixes.js'

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
  return { damage: Math.round((player.damage ?? 1) * multiplier), critical }
}

export function modifiedDamage(player, enemy, baseDamage) {
  let damage = baseDamage
  const effects = player?.effects ?? {}
  const hpRatio = (player?.maxHp ?? 0) > 0 ? (player.hp ?? 0) / player.maxHp : 1
  const enemyRatio = (enemy?.maxHp ?? 0) > 0 ? (enemy.hp ?? 0) / enemy.maxHp : 1
  if (hpRatio < 0.4) damage *= 1 + (effects.lowHealthDamage ?? 0)
  if (enemyRatio < 0.3) damage *= 1 + (effects.executioner ?? 0)
  return Math.max(1, Math.round(damage))
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
    affixes: rollAffixes(level, rarity, random),
  }
}

export function rollPotion(random = Math.random) {
  if (random() >= 0.12) return null
  return { type: 'consumable.health_potion', rarity: 'common', heal: 28 }
}

export function enemyArchetype(floor, random = Math.random, { elite = false } = {}) {
  if (elite) return { ...bossProfile(floor), type: 'brute', elite: true, boss: true, speedMultiplier: 0.78 }
  const roll = random()
  const level = Math.max(1, Math.floor(floor || 1))

  if (level >= 3) {
    if (roll < 0.42) return { type: 'skeleton', hpMultiplier: 1, speedMultiplier: 1, scale: 1, contactDamage: 10, elite: false, boss: false }
    if (roll < 0.64) return { type: 'fast', hpMultiplier: 0.65, speedMultiplier: 1.55, scale: 0.9, contactDamage: 8, elite: false, boss: false }
    if (roll < 0.80) return {
      type: 'ranged',
      hpMultiplier: 0.82,
      speedMultiplier: 0.82,
      scale: 1,
      contactDamage: 7,
      attackRange: 230,
      preferredRange: 185,
      projectileDamage: 11 + Math.min(5, level),
      projectileCooldown: Math.max(900, 1450 - level * 70),
      projectileSpeed: 245 + level * 10,
      elite: false,
      boss: false,
    }
    return { type: 'brute', hpMultiplier: 1.75, speedMultiplier: 0.72, scale: 1.2, contactDamage: 14, elite: false, boss: false }
  }

  if (roll < 0.5) return { type: 'skeleton', hpMultiplier: 1, speedMultiplier: 1, scale: 1, contactDamage: 10, elite: false, boss: false }
  if (roll < 0.78) return { type: 'fast', hpMultiplier: 0.65, speedMultiplier: 1.55, scale: 0.9, contactDamage: 8, elite: false, boss: false }
  return { type: 'brute', hpMultiplier: 1.75, speedMultiplier: 0.72, scale: 1.2, contactDamage: 14, elite: false, boss: false }
}

export function bossProfile(floor = 5) {
  const level = Math.max(1, Math.min(5, Math.floor(floor || 5)))
  return {
    hpMultiplier: 6.4 + Math.max(0, level - 4) * 0.35,
    scale: 1.75,
    contactDamage: 24,
    phaseThreshold: 0.5,
    chargeCooldown: 3800,
    shockwaveCooldown: 5200,
  }
}

export function bossReward(random = Math.random, floor = 5) {
  const roll = random()
  const rarity = roll >= 0.72 ? 'epic' : 'rare'
  return {
    type: 'weapon.dungeon_blade',
    rarity,
    damage: rarity === 'epic' ? 12 : 8,
    affixes: rollAffixes(floor, rarity, random, { forceBuild: true }),
  }
}

export function floorWave(floor) {
  const level = Math.max(1, Math.min(5, Math.floor(floor || 1)))
  if (level === 5) return { count: 9, eliteCount: 1 }
  return { count: 10 + level * 2, eliteCount: 0 }
}

export function rollDrop(_floor, random = Math.random) {
  const roll = random()
  if (roll < 0.18) return { type: 'weapon.rust_sword', rarity: 'uncommon', damage: 3 }
  if (roll < 0.30) return { type: 'consumable.health_potion', rarity: 'common', heal: 28 }
  return null
}

const DEFAULT_BASE_STATS = { damage: 10, critChance: 0.18, speed: 190, maxHp: 100 }

export function applyPickup(player, item, baseStats = player?.baseStats ?? DEFAULT_BASE_STATS) {
  if (!item) return { ...player }
  if (item.type?.startsWith('weapon.')) {
    return {
      ...deriveEquipment(baseStats, item, player),
      baseStats: { ...baseStats },
    }
  }
  if (item.type === 'consumable.health_potion') {
    const maxHp = player.maxHp ?? player.hp ?? 0
    return { ...player, hp: Math.min(maxHp, (player.hp ?? 0) + (item.heal ?? 0)) }
  }
  return { ...player }
}
