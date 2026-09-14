import { weaponDefinition } from './weapon-catalog.js'

const NAMES = {
  'zh-CN': {
    power: '伤害', attack_speed: '攻速', critical: '暴击', movement_speed: '移速', vitality: '最大生命', life_steal: '吸血',
    piercing: '贯穿', chain: '连锁', corpse_burst: '尸爆', critical_heal: '暴击回血', hurt_haste: '受伤加速', low_health_damage: '背水增伤', skill_radius: '技能范围', skill_haste: '技能急速',
    whirlwind: '旋风', volley: '箭雨', arcane_nova: '奥术新星', thunder: '雷鸣', executioner: '处刑', berserker: '狂战',
  },
  en: {
    power: 'Damage', attack_speed: 'Attack Speed', critical: 'Crit', movement_speed: 'Move Speed', vitality: 'Max HP', life_steal: 'Life Steal',
    piercing: 'Pierce', chain: 'Chain', corpse_burst: 'Corpse Burst', critical_heal: 'HP on Crit', hurt_haste: 'Hurt Haste', low_health_damage: 'Low HP Damage', skill_radius: 'Skill Radius', skill_haste: 'Skill Haste',
    whirlwind: 'Whirlwind', volley: 'Volley', arcane_nova: 'Arcane Nova', thunder: 'Thunder', executioner: 'Executioner', berserker: 'Berserker',
  },
}

const WEAPON_NAMES_ZH = Object.freeze({
  iron_fang: '铁牙',
  warden_blade: '守望之刃',
  ash_saber: '灰烬刀',
  grave_cleaver: '墓冢战斧',
  frostbite: '霜噬',
  storm_lance: '风暴长枪',
  ember_maul: '余烬重刃',
  void_edge: '虚空之锋',
  blood_reaver: '血掠者',
  arcane_spire: '奥术法杖',
  tempest_bow: '风暴弓',
  starfall_spear: '星陨长枪',
  kings_ruin: '王者之殇',
  sunfall: '日陨',
  white_silence: '白色寂静',
  stormcrown: '风暴王冠',
  void_testament: '虚空遗言',
  blood_oath: '血誓',
  dawn_reaver: '黎明掠者',
  cinder_vow: '余烬之誓',
  winters_end: '凛冬终焉',
  thunderwake: '雷霆余响',
  starless_edge: '无星之锋',
  crimson_verdict: '绯红裁决',
})

const ARCHETYPE_NAMES = Object.freeze({
  'zh-CN': {
    dagger: '匕首',
    sword: '长剑',
    katana: '太刀',
    axe: '战斧',
    spear: '长枪',
    greatsword: '巨剑',
    staff: '法杖',
    bow: '弓',
  },
  en: {
    dagger: 'Dagger',
    sword: 'Sword',
    katana: 'Katana',
    axe: 'Axe',
    spear: 'Spear',
    greatsword: 'Greatsword',
    staff: 'Staff',
    bow: 'Bow',
  },
})

const PERCENT_PREFIX = new Set(['power', 'attack_speed', 'critical', 'movement_speed', 'skill_radius', 'skill_haste'])
const PERCENT_SUFFIX = new Set(['life_steal', 'piercing', 'chain', 'corpse_burst', 'hurt_haste', 'low_health_damage'])
const BUILD = new Set(['whirlwind', 'volley', 'arcane_nova', 'thunder', 'executioner', 'berserker'])

const COMBAT_VISUALS = {
  thunder: { kind: 'chain-lightning', color: 0x8fdcff, width: 4, duration: 150 },
  whirlwind: { kind: 'radial-slash', color: 0xc984ff, radius: 112, duration: 220 },
  volley: { kind: 'volley', color: 0x8fdcff, radius: 190, duration: 180 },
  arcane_nova: { kind: 'arcane-nova', color: 0xc984ff, radius: 118, duration: 260 },
  corpse_burst: { kind: 'corpse-burst', color: 0xff875f, radius: 82, duration: 260 },
  piercing: { kind: 'pierce-trail', color: 0xeafbc9, length: 92, duration: 160 },
  heal: { kind: 'heal-number', color: '#70ff9f', duration: 620 },
  critical: { kind: 'critical-hit', color: '#ffdc68', shake: 0.006, duration: 120 },
}

function percent(value) {
  return Math.round((value ?? 0) * 100)
}

function weaponIdentity(item) {
  if (!item) return null
  const value = typeof item === 'string' ? { type: item } : item
  const definition = weaponDefinition(value.id ?? value.type)
  return definition ? { ...definition, ...value } : { ...value }
}

export function weaponDisplayName(item, locale = 'en') {
  const identity = weaponIdentity(item)
  if (!identity) return null
  if (locale === 'zh-CN') {
    const localized = WEAPON_NAMES_ZH[identity.id]
    if (localized) return localized
  }
  return identity.name ?? null
}

export function weaponArchetypeLabel(item, locale = 'en') {
  const identity = weaponIdentity(item)
  if (!identity?.archetype) return null
  const lang = ARCHETYPE_NAMES[locale] ? locale : 'en'
  return ARCHETYPE_NAMES[lang][identity.archetype] ?? identity.archetype
}

export function weaponIdentityLabel(item, locale = 'en') {
  const type = weaponArchetypeLabel(item, locale)
  const name = weaponDisplayName(item, locale)
  return [type, name].filter(Boolean).join(' · ')
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

function comparisonWeapon(item, other, locale, side) {
  if (!item) return null
  return {
    name: weaponDisplayName(item, locale),
    archetypeLabel: weaponArchetypeLabel(item, locale),
    legendaryLevel: item.legendaryLevel ?? null,
    rarity: item.rarity ?? null,
    damage: item.damage ?? 0,
    affixes: compareAffixes(item.affixes ?? [], other?.affixes ?? [], locale, side),
  }
}

export function weaponComparisonModel(current, candidate, locale = 'en') {
  const currentDamage = current?.damage ?? 0
  const candidateDamage = candidate?.damage ?? 0
  const currentModel = comparisonWeapon(current, candidate, locale, 'current')
  const candidateModel = comparisonWeapon(candidate ?? {}, current, locale, 'candidate')
  return {
    current: currentModel,
    candidate: {
      ...candidateModel,
      damageDelta: candidateDamage - currentDamage,
    },
  }
}

export function weaponHudModel(stats = {}, locale = 'en') {
  const item = stats.equippedWeapon ?? stats.weapon ?? null
  return {
    equipped: Boolean(stats.weapon),
    name: weaponDisplayName(item, locale),
    archetypeLabel: weaponArchetypeLabel(item, locale),
    legendaryLevel: typeof item === 'object' ? (item?.legendaryLevel ?? null) : null,
    rarity: stats.weaponRarity ?? (typeof item === 'object' ? item?.rarity : null) ?? null,
    damage: stats.weaponDamage ?? (typeof item === 'object' ? item?.damage : 0) ?? 0,
    affixes: (stats.weaponAffixes ?? (typeof item === 'object' ? item?.affixes : []) ?? []).map((entry) => formatAffixLabel(entry, locale)),
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
