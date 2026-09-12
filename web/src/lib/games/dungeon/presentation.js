const NAMES = {
  'zh-CN': {
    power: '伤害', attack_speed: '攻速', critical: '暴击', movement_speed: '移速', vitality: '最大生命', life_steal: '吸血',
    piercing: '贯穿', chain: '连锁', corpse_burst: '尸爆', critical_heal: '暴击回血', hurt_haste: '受伤加速', low_health_damage: '背水增伤', skill_radius: '技能范围', skill_haste: '技能急速',
    whirlwind: '旋风', thunder: '雷鸣', executioner: '处刑', berserker: '狂战',
  },
  en: {
    power: 'Damage', attack_speed: 'Attack Speed', critical: 'Crit', movement_speed: 'Move Speed', vitality: 'Max HP', life_steal: 'Life Steal',
    piercing: 'Pierce', chain: 'Chain', corpse_burst: 'Corpse Burst', critical_heal: 'HP on Crit', hurt_haste: 'Hurt Haste', low_health_damage: 'Low HP Damage', skill_radius: 'Skill Radius', skill_haste: 'Skill Haste',
    whirlwind: 'Whirlwind', thunder: 'Thunder', executioner: 'Executioner', berserker: 'Berserker',
  },
}

const PERCENT_PREFIX = new Set(['power', 'attack_speed', 'critical', 'movement_speed', 'skill_radius', 'skill_haste'])
const PERCENT_SUFFIX = new Set(['life_steal', 'piercing', 'chain', 'corpse_burst', 'hurt_haste', 'low_health_damage'])
const BUILD = new Set(['whirlwind', 'thunder', 'executioner', 'berserker'])

const COMBAT_VISUALS = {
  thunder: { kind: 'chain-lightning', color: 0x8fdcff, width: 4, duration: 150 },
  whirlwind: { kind: 'radial-slash', color: 0xc984ff, radius: 112, duration: 220 },
  corpse_burst: { kind: 'corpse-burst', color: 0xff875f, radius: 82, duration: 260 },
  piercing: { kind: 'pierce-trail', color: 0xeafbc9, length: 92, duration: 160 },
  heal: { kind: 'heal-number', color: '#70ff9f', duration: 620 },
  critical: { kind: 'critical-hit', color: '#ffdc68', shake: 0.006, duration: 120 },
}

function percent(value) {
  return Math.round((value ?? 0) * 100)
}

export function combatVisualCue(type) {
  const cue = COMBAT_VISUALS[type]
  return cue ? { ...cue } : null
}

export function formatAffixLabel(entry, locale = 'en') {
  const lang = NAMES[locale] ? locale : 'en'
  const name = NAMES[lang][entry?.id] ?? entry?.id ?? ''
  const value = entry?.value ?? 0

  if (entry?.id === 'vitality') return `+${Math.round(value)} ${name}`
  if (entry?.id === 'critical_heal') return `+${Math.round(value)} ${name}`
  if (BUILD.has(entry?.id)) {
    if (entry.id === 'executioner') return `★ ${name} +${percent(value)}%`
    return `★ ${name} ${percent(value)}%`
  }
  if (PERCENT_PREFIX.has(entry?.id)) return `+${percent(value)}% ${name}`
  if (PERCENT_SUFFIX.has(entry?.id)) return `${percent(value)}% ${name}`
  return `${name} ${value}`
}

function compareAffixes(entries = [], otherEntries = [], locale = 'en', side = 'candidate') {
  const other = new Map(otherEntries.map((entry) => [entry.id, entry]))
  return entries.map((entry, index) => {
    const previous = other.get(entry.id)
    let direction = side === 'candidate' ? 'new' : 'lost'
    if (previous) {
      if ((entry.value ?? 0) > (previous.value ?? 0)) direction = 'up'
      else if ((entry.value ?? 0) < (previous.value ?? 0)) direction = 'down'
      else direction = 'same'
    }
    return { ...entry, label: formatAffixLabel(entry, locale), build: BUILD.has(entry.id), direction, _index: index }
  }).sort((a, b) => Number(b.build) - Number(a.build) || a._index - b._index).map(({ _index, ...entry }) => entry)
}

export function weaponComparisonModel(current, candidate, locale = 'en') {
  const currentAffixes = current?.affixes ?? []
  const candidateAffixes = candidate?.affixes ?? []
  const currentDamage = current?.damage ?? 0
  const candidateDamage = candidate?.damage ?? 0
  return {
    current: current ? {
      rarity: current.rarity ?? null,
      damage: currentDamage,
      affixes: compareAffixes(currentAffixes, candidateAffixes, locale, 'current'),
    } : null,
    candidate: {
      rarity: candidate?.rarity ?? null,
      damage: candidateDamage,
      damageDelta: candidateDamage - currentDamage,
      affixes: compareAffixes(candidateAffixes, currentAffixes, locale, 'candidate'),
    },
  }
}

export function weaponHudModel(stats = {}, locale = 'en') {
  return {
    equipped: Boolean(stats.weapon),
    rarity: stats.weaponRarity ?? null,
    damage: stats.weaponDamage ?? 0,
    affixes: (stats.weaponAffixes ?? []).map((entry) => formatAffixLabel(entry, locale)),
  }
}

export function gameOverSummary(stats = {}, progress = {}) {
  return {
    floor: Math.max(1, Math.floor(progress.floor || 1)),
    kills: Math.max(0, Math.floor(stats.kills || 0)),
    weapon: Boolean(stats.weapon),
    rarity: stats.weaponRarity ?? null,
    damage: Math.max(0, Math.floor(stats.weaponDamage || 0)),
  }
}
