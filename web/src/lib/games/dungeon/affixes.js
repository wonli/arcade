const tierForFloor = (floor) => floor >= 5 ? 3 : floor >= 3 ? 2 : 1

const rangedValue = (ranges, tier, random) => {
  const [min, max] = ranges[Math.max(0, Math.min(2, tier - 1))]
  const roll = Math.max(0, Math.min(0.999999, random()))
  const value = min + (max - min) * roll
  const decimals = Number.isInteger(min) && Number.isInteger(max) ? 0 : 3
  return decimals === 0 ? Math.round(value) : Number(value.toFixed(decimals))
}

function affix(id, category, weight, ranges, { minFloor = 1, conflict = null } = {}) {
  return { id, category, weight, ranges, minFloor, conflict }
}

export const AFFIXES = {
  power: affix('power', 'basic', 1.15, [[0.08, 0.12], [0.12, 0.18], [0.18, 0.26]]),
  attack_speed: affix('attack_speed', 'basic', 1.05, [[0.07, 0.10], [0.10, 0.15], [0.15, 0.22]]),
  critical: affix('critical', 'basic', 0.95, [[0.025, 0.04], [0.04, 0.065], [0.065, 0.10]]),
  movement_speed: affix('movement_speed', 'basic', 0.90, [[0.05, 0.08], [0.08, 0.11], [0.11, 0.16]]),
  vitality: affix('vitality', 'basic', 0.95, [[12, 18], [18, 26], [26, 38]]),
  life_steal: affix('life_steal', 'basic', 0.72, [[0.025, 0.04], [0.04, 0.065], [0.065, 0.10]]),

  piercing: affix('piercing', 'mechanic', 0.72, [[0.22, 0.30], [0.30, 0.42], [0.42, 0.58]], { minFloor: 2 }),
  chain: affix('chain', 'mechanic', 0.70, [[0.22, 0.30], [0.30, 0.42], [0.42, 0.55]], { minFloor: 2 }),
  corpse_burst: affix('corpse_burst', 'mechanic', 0.62, [[0.35, 0.45], [0.45, 0.60], [0.60, 0.82]], { minFloor: 2 }),
  critical_heal: affix('critical_heal', 'mechanic', 0.62, [[3, 5], [5, 8], [8, 12]], { minFloor: 2 }),
  hurt_haste: affix('hurt_haste', 'mechanic', 0.60, [[0.10, 0.14], [0.14, 0.20], [0.20, 0.28]], { minFloor: 2 }),
  low_health_damage: affix('low_health_damage', 'mechanic', 0.65, [[0.14, 0.20], [0.20, 0.30], [0.30, 0.44]], { minFloor: 2 }),
  skill_radius: affix('skill_radius', 'mechanic', 0.66, [[0.12, 0.18], [0.18, 0.28], [0.28, 0.40]], { minFloor: 2 }),
  skill_haste: affix('skill_haste', 'mechanic', 0.66, [[0.10, 0.15], [0.15, 0.22], [0.22, 0.32]], { minFloor: 2 }),

  whirlwind: affix('whirlwind', 'build', 0.40, [[0.14, 0.18], [0.18, 0.26], [0.26, 0.36]], { minFloor: 3, conflict: 'build' }),
  thunder: affix('thunder', 'build', 0.40, [[0.22, 0.28], [0.28, 0.38], [0.38, 0.52]], { minFloor: 3, conflict: 'build' }),
  executioner: affix('executioner', 'build', 0.38, [[0.25, 0.34], [0.34, 0.50], [0.50, 0.72]], { minFloor: 3, conflict: 'build' }),
  berserker: affix('berserker', 'build', 0.38, [[0.16, 0.22], [0.22, 0.32], [0.32, 0.46]], { minFloor: 3, conflict: 'build' }),
}

export function affixSlots(rarity = 'common') {
  return { common: 0, uncommon: 1, rare: 2, epic: 3 }[rarity] ?? 0
}

function weightedPick(pool, random) {
  const total = pool.reduce((sum, entry) => sum + entry.weight, 0)
  if (total <= 0) return null
  let roll = Math.max(0, Math.min(0.999999, random())) * total
  for (const entry of pool) {
    roll -= entry.weight
    if (roll < 0) return entry
  }
  return pool.at(-1) ?? null
}

function rolledAffix(definition, floor, random) {
  const tier = tierForFloor(floor)
  return {
    id: definition.id,
    tier,
    value: rangedValue(definition.ranges, tier, random),
  }
}

export function rollAffixes(floor, rarity, random = Math.random, { forceBuild = false } = {}) {
  const slots = affixSlots(rarity)
  if (slots <= 0) return []

  const level = Math.max(1, Math.min(5, Math.floor(floor || 1)))
  const eligible = Object.values(AFFIXES).filter((entry) => level >= entry.minFloor)
  const selected = []
  const usedIds = new Set()
  const usedConflicts = new Set()

  const add = (definition) => {
    if (!definition || usedIds.has(definition.id)) return false
    if (definition.conflict && usedConflicts.has(definition.conflict)) return false
    selected.push(rolledAffix(definition, level, random))
    usedIds.add(definition.id)
    if (definition.conflict) usedConflicts.add(definition.conflict)
    return true
  }

  if (forceBuild && level >= 3) {
    const buildPool = eligible.filter((entry) => entry.category === 'build')
    add(weightedPick(buildPool, random))
  }

  while (selected.length < slots) {
    const pool = eligible.filter((entry) => !usedIds.has(entry.id) && (!entry.conflict || !usedConflicts.has(entry.conflict)))
    if (!pool.length) break
    if (!add(weightedPick(pool, random))) break
  }

  return selected
}

function emptyEffects() {
  return {
    attackSpeed: 0,
    lifeSteal: 0,
    piercing: 0,
    chain: 0,
    corpseBurst: 0,
    criticalHeal: 0,
    hurtHaste: 0,
    lowHealthDamage: 0,
    skillRadius: 0,
    skillHaste: 0,
    whirlwind: 0,
    thunder: 0,
    executioner: 0,
    berserker: 0,
  }
}

export function deriveEquipment(base, item = null, current = {}) {
  const weaponDamage = item?.damage ?? 0
  let damage = (base.damage ?? 10) + weaponDamage
  let critChance = base.critChance ?? 0.18
  let speed = base.speed ?? 190
  let maxHp = base.maxHp ?? 100
  const effects = emptyEffects()

  for (const rolled of item?.affixes ?? []) {
    switch (rolled.id) {
      case 'power': damage *= 1 + rolled.value; break
      case 'attack_speed': effects.attackSpeed += rolled.value; break
      case 'critical': critChance += rolled.value; break
      case 'movement_speed': speed *= 1 + rolled.value; break
      case 'vitality': maxHp += rolled.value; break
      case 'life_steal': effects.lifeSteal += rolled.value; break
      case 'piercing': effects.piercing = Math.max(effects.piercing, rolled.value); break
      case 'chain': effects.chain = Math.max(effects.chain, rolled.value); break
      case 'corpse_burst': effects.corpseBurst = Math.max(effects.corpseBurst, rolled.value); break
      case 'critical_heal': effects.criticalHeal += rolled.value; break
      case 'hurt_haste': effects.hurtHaste = Math.max(effects.hurtHaste, rolled.value); break
      case 'low_health_damage': effects.lowHealthDamage += rolled.value; break
      case 'skill_radius': effects.skillRadius += rolled.value; break
      case 'skill_haste': effects.skillHaste += rolled.value; break
      case 'whirlwind': effects.whirlwind = Math.max(effects.whirlwind, rolled.value); break
      case 'thunder': effects.thunder = Math.max(effects.thunder, rolled.value); break
      case 'executioner': effects.executioner = Math.max(effects.executioner, rolled.value); break
      case 'berserker': effects.berserker = Math.max(effects.berserker, rolled.value); break
    }
  }

  damage = Math.max(1, Math.round(damage))
  critChance = Math.max(0, Math.min(0.85, critChance))
  speed = Math.round(speed)
  maxHp = Math.round(maxHp)

  const previousMaxHp = current.maxHp ?? (base.maxHp ?? maxHp)
  const previousHp = current.hp ?? previousMaxHp
  const gainedMaxHp = Math.max(0, maxHp - previousMaxHp)
  const hp = Math.min(maxHp, Math.max(0, previousHp + gainedMaxHp))

  return {
    ...current,
    damage,
    critChance,
    speed,
    maxHp,
    hp,
    weapon: item?.type ?? null,
    weaponRarity: item?.rarity ?? null,
    weaponDamage,
    weaponAffixes: item?.affixes ? [...item.affixes] : [],
    equippedWeapon: item ? { ...item, affixes: [...(item.affixes ?? [])] } : null,
    effects,
  }
}

export function affixSummary(item) {
  return (item?.affixes ?? []).map((rolled) => ({
    ...rolled,
    category: AFFIXES[rolled.id]?.category ?? 'basic',
    build: AFFIXES[rolled.id]?.category === 'build',
  }))
}
