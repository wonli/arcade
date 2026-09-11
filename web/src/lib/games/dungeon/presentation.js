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

function percent(value) {
  return Math.round((value ?? 0) * 100)
}

export function formatAffixLabel(entry, locale = 'en') {
  const lang = NAMES[locale] ? locale : 'en'
  const name = NAMES[lang][entry?.id] ?? entry?.id ?? ''
  const value = entry?.value ?? 0

  if (entry?.id === 'vitality') return `+${Math.round(value)} ${name}`
  if (entry?.id === 'critical_heal') return lang === 'zh-CN' ? `+${Math.round(value)} ${name}` : `+${Math.round(value)} ${name}`
  if (BUILD.has(entry?.id)) {
    if (entry.id === 'executioner') return `★ ${name} +${percent(value)}%`
    return `★ ${name} ${percent(value)}%`
  }
  if (PERCENT_PREFIX.has(entry?.id)) return `+${percent(value)}% ${name}`
  if (PERCENT_SUFFIX.has(entry?.id)) return `${percent(value)}% ${name}`
  return `${name} ${value}`
}

export function weaponHudModel(stats = {}, locale = 'en') {
  return {
    equipped: Boolean(stats.weapon),
    rarity: stats.weaponRarity ?? null,
    damage: stats.weaponDamage ?? 0,
    affixes: (stats.weaponAffixes ?? []).map((entry) => formatAffixLabel(entry, locale)),
  }
}
