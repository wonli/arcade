import { materializeLegendary } from './legendary-growth.js'

const legendary = (id, name, swordNumber, vfxTheme, vfxVariant, archetype, baseDamage, affixes, signatureAffixes) => ({
  id,
  name,
  type: `weapon.${id}`,
  archetype,
  vfxTheme,
  vfxVariant,
  swordNumber,
  baseDamage,
  bossOnly: true,
  minFloor: 5,
  affixes: affixes.map(([affixId, value]) => ({ id: affixId, tier: 4, value })),
  signatureAffixes: [...signatureAffixes],
})

export const LEGENDARY_WEAPON_CATALOG = Object.freeze([
  legendary('kings_ruin', 'King’s Ruin', 11, 'steel', 2, 'sword', 24, [
    ['power', 0.55], ['critical', 0.16], ['chain', 0.65], ['attack_speed', 0.28],
  ], ['power', 'chain']),
  legendary('sunfall', 'Sunfall', 12, 'ember', 2, 'sword', 27, [
    ['power', 0.65], ['corpse_burst', 0.95], ['berserker', 0.60], ['attack_speed', 0.22],
  ], ['corpse_burst', 'berserker']),
  legendary('white_silence', 'White Silence', 13, 'frost', 1, 'katana', 25, [
    ['critical', 0.20], ['life_steal', 0.16], ['executioner', 0.82], ['skill_radius', 0.55],
  ], ['executioner', 'critical']),
  legendary('stormcrown', 'Stormcrown', 14, 'storm', 2, 'sword', 28, [
    ['thunder', 0.85], ['chain', 0.80], ['attack_speed', 0.35], ['critical', 0.18],
  ], ['thunder', 'chain']),
  legendary('void_testament', 'Void Testament', 15, 'arcane', 3, 'katana', 29, [
    ['skill_haste', 0.50], ['skill_radius', 0.65], ['piercing', 0.80], ['power', 0.45],
  ], ['skill_haste', 'piercing']),
  legendary('blood_oath', 'Blood Oath', 16, 'blood', 2, 'sword', 30, [
    ['life_steal', 0.22], ['berserker', 0.75], ['low_health_damage', 0.70], ['critical_heal', 18],
  ], ['life_steal', 'berserker']),
  legendary('dawn_reaver', 'Dawn Reaver', 17, 'steel', 3, 'katana', 31, [
    ['power', 0.48], ['attack_speed', 0.38], ['piercing', 0.72], ['chain', 0.55],
  ], ['attack_speed', 'piercing']),
  legendary('cinder_vow', 'Cinder Vow', 18, 'ember', 3, 'sword', 32, [
    ['power', 0.72], ['corpse_burst', 1.05], ['low_health_damage', 0.65], ['critical', 0.14],
  ], ['corpse_burst', 'power']),
  legendary('winters_end', 'Winter’s End', 19, 'frost', 2, 'katana', 30, [
    ['executioner', 0.95], ['critical', 0.22], ['life_steal', 0.12], ['piercing', 0.68],
  ], ['executioner', 'critical']),
  legendary('thunderwake', 'Thunderwake', 20, 'storm', 3, 'sword', 34, [
    ['thunder', 1.00], ['chain', 0.90], ['attack_speed', 0.40], ['power', 0.42],
  ], ['thunder', 'chain']),
  legendary('starless_edge', 'Starless Edge', 21, 'arcane', 4, 'katana', 35, [
    ['skill_haste', 0.58], ['skill_radius', 0.75], ['piercing', 0.90], ['chain', 0.65],
  ], ['skill_haste', 'piercing']),
  legendary('crimson_verdict', 'Crimson Verdict', 22, 'blood', 3, 'sword', 36, [
    ['life_steal', 0.25], ['berserker', 0.82], ['low_health_damage', 0.82], ['critical_heal', 22],
  ], ['life_steal', 'low_health_damage']),
])

export function materializeBossLegendary(definition, floor = 5) {
  const depth = Math.max(0, Math.floor(floor || 1) - 1)
  const depthBonus = Math.round(depth * 1.35 + depth * depth * 0.035)
  const legendaryBaseDamage = Math.round(definition.baseDamage * 2.6) + depthBonus
  const legendaryBaseAffixes = definition.affixes.map((entry) => ({ ...entry }))
  return materializeLegendary({
    id: definition.id,
    name: definition.name,
    type: definition.type,
    archetype: definition.archetype,
    vfxTheme: definition.vfxTheme,
    vfxVariant: definition.vfxVariant,
    swordNumber: definition.swordNumber,
    rarity: 'legendary',
    damage: legendaryBaseDamage,
    bossOnly: true,
    legendaryLevel: 1,
    legendaryBaseDamage,
    legendaryBaseAffixes,
    affixes: legendaryBaseAffixes.map((entry) => ({ ...entry })),
    signatureAffixes: [...definition.signatureAffixes],
  }, 1)
}

export function rollBossLegendary(floor = 5, random = Math.random) {
  const roll = Math.max(0, Math.min(0.999999, random()))
  const definition = LEGENDARY_WEAPON_CATALOG[Math.floor(roll * LEGENDARY_WEAPON_CATALOG.length)]
    ?? LEGENDARY_WEAPON_CATALOG[0]
  return materializeBossLegendary(definition, floor)
}
