import { deriveEquipment, rollAffixes } from './affixes.js'
import { pickupHealthPotion } from './inventory.js'
import { rollBossLegendary } from './legendary-weapons.js'
import { currentEffects } from './player-loadout.js'
import { weaponProfile } from './weapon-profile.js'

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

export function secondaryTarget(primary, enemies, maxDistance = 150) {
  let best = null
  let bestDistance = maxDistance * maxDistance
  for (const enemy of enemies) {
    if (!enemy || enemy === primary || enemy.id === primary?.id || enemy.hp <= 0) continue
    const dx = enemy.x - primary.x
    const dy = enemy.y - primary.y
    const distance = dx * dx + dy * dy
    if (distance <= bestDistance) {
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
  const effects = currentEffects(player)
  const hpRatio = (player?.maxHp ?? 0) > 0 ? (player.hp ?? 0) / player.maxHp : 1
  const enemyRatio = (enemy?.maxHp ?? 0) > 0 ? (enemy.hp ?? 0) / enemy.maxHp : 1
  if (hpRatio < 0.4) damage *= 1 + (effects.lowHealthDamage ?? 0)
  if (enemyRatio < 0.3) damage *= 1 + (effects.executioner ?? 0)
  return Math.max(1, Math.round(damage))
}

export function attackInterval(player, now = 0, baseInterval = 430) {
  const effects = currentEffects(player)
  let haste = effects.attackSpeed ?? 0
  const maxHp = player?.maxHp ?? 0
  const hpRatio = maxHp > 0 ? Math.max(0, Math.min(1, (player.hp ?? maxHp) / maxHp)) : 1
  if ((effects.berserker ?? 0) > 0) haste += effects.berserker * (1 - hpRatio)
  if ((player?.hasteUntil ?? 0) > now) haste += effects.hurtHaste ?? 0
  const base = baseInterval * weaponProfile(player).intervalMultiplier
  return Math.max(160, Math.round(base / (1 + Math.max(0, haste))))
}

export function skillProfile(player, baseRadius = 130, baseCooldown = 4200) {
  const effects = currentEffects(player)
  return {
    radius: Math.round(baseRadius * (1 + (effects.skillRadius ?? 0))),
    cooldown: Math.max(1200, Math.round(baseCooldown * (1 - Math.min(0.65, effects.skillHaste ?? 0)))),
  }
}

export function healFromHit(player, damage, critical, { direct = true } = {}) {
  if (!direct) return 0
  const effects = currentEffects(player)
  const lifeSteal = Math.max(0, Math.round(damage * (effects.lifeSteal ?? 0)))
  const criticalHeal = critical ? Math.max(0, Math.round(effects.criticalHeal ?? 0)) : 0
  return lifeSteal + criticalHeal
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

export function rollWeaponArchetype(random = Math.random) {
  const roll = random()
  if (roll < 0.18) return 'dagger'
  if (roll < 0.432) return 'sword'
  if (roll < 0.60) return 'katana'
  if (roll < 0.80) return 'bow'
  return 'staff'
}

function equipmentThresholds(floor) {
  const level = Math.max(1, Math.min(5, Math.floor(floor || 1)))
  const base = EQUIPMENT_TABLES[level]
  const deepBonus = Math.min(0.28, Math.max(0, Math.floor(floor || 1) - 5) * 0.012)
  return [
    Math.max(0.03, base[0] - deepBonus * 0.15),
    Math.max(0.08, base[1] - deepBonus * 0.10),
    Math.min(0.62, base[2] + deepBonus * 0.35),
    Math.min(0.72, base[3] + deepBonus),
  ]
}

export function rollEquipment(floor, random = Math.random) {
  const actualFloor = Math.max(1, Math.floor(floor || 1))
  const roll = random()
  const [commonEnd, uncommonEnd, rareEnd, epicEnd] = equipmentThresholds(actualFloor)
  let rarity = null
  if (roll < commonEnd) rarity = 'common'
  else if (roll < uncommonEnd) rarity = 'uncommon'
  else if (roll < rareEnd) rarity = 'rare'
  else if (roll < epicEnd) rarity = 'epic'
  if (!rarity) return null
  const depthBonus = Math.round(Math.max(0, actualFloor - 1) * 0.7)
  return {
    type: 'weapon.dungeon_blade',
    archetype: rollWeaponArchetype(random),
    rarity,
    damage: damageForRarity(rarity, roll * 7.31) + depthBonus,
    affixes: rollAffixes(actualFloor, rarity, random, { forceBuild: rarity === 'epic' && actualFloor >= 5 }),
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
      type: 'ranged', hpMultiplier: 0.82, speedMultiplier: 0.82, scale: 1, contactDamage: 7,
      attackRange: 230, preferredRange: 185, projectileDamage: 11 + Math.min(5, level),
      projectileCooldown: Math.max(900, 1450 - level * 70), projectileSpeed: 245 + level * 10,
      elite: false, boss: false,
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

function normalBossReward(random = Math.random, floor = 5) {
  const actualFloor = Math.max(1, Math.floor(floor || 1))
  const depth = Math.max(0, actualFloor - 1)
  const epicThreshold = Math.max(0.40, 0.72 - Math.max(0, actualFloor - 5) * 0.015)
  const roll = random()
  const rarity = roll >= epicThreshold ? 'epic' : 'rare'
  const floorBonus = Math.round(depth * 1.15 + depth * depth * 0.018)
  return {
    type: 'weapon.dungeon_blade',
    archetype: rollWeaponArchetype(random),
    rarity,
    damage: (rarity === 'epic' ? 12 : 8) + floorBonus,
    affixes: rollAffixes(actualFloor, rarity, random, { forceBuild: true }),
  }
}

export function bossReward(random = Math.random, floor = 5) {
  if (random() < 0.05) return rollBossLegendary(floor, random)
  return normalBossReward(random, floor)
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
  if (item.type === 'consumable.health_potion') return pickupHealthPotion(player).state
  return { ...player }
}
