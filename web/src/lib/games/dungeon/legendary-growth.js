import { deriveEquipment } from './affixes.js'
import { currentWeapon } from './player-loadout.js'

const LEVEL_CAP = 20
const VFX_SIZES = [16, 18, 20, 22, 24]

const cloneAffixes = (affixes = []) => affixes.map((entry) => ({ ...entry }))
const levelOf = (value) => Math.max(1, Math.min(LEVEL_CAP, Math.floor(Number(value) || 1)))

export function isLegendaryWeapon(item) {
  return Boolean(item && item.rarity === 'legendary' && item.type?.startsWith?.('weapon.'))
}

export function legendaryAwakening(level = 1) {
  const next = levelOf(level)
  if (next >= 20) return 4
  if (next >= 15) return 3
  if (next >= 10) return 2
  if (next >= 5) return 1
  return 0
}

export function normalizeLegendary(item) {
  if (!isLegendaryWeapon(item)) return item
  return {
    ...item,
    legendaryLevel: levelOf(item.legendaryLevel),
    legendaryBaseDamage: Number.isFinite(item.legendaryBaseDamage) ? item.legendaryBaseDamage : (item.damage ?? 0),
    legendaryBaseAffixes: cloneAffixes(item.legendaryBaseAffixes ?? item.affixes),
    signatureAffixes: [...(item.signatureAffixes ?? [])],
  }
}

export function materializeLegendary(item, requestedLevel = item?.legendaryLevel ?? 1) {
  if (!isLegendaryWeapon(item)) return item
  const base = normalizeLegendary(item)
  const level = levelOf(requestedLevel)
  const awakening = legendaryAwakening(level)
  const damageMultiplier = 1 + 0.10 * (level - 1) + 0.20 * awakening
  const affixMultiplier = 1 + 0.025 * (level - 1) + 0.10 * awakening
  const signatures = new Set(base.signatureAffixes)
  const affixes = base.legendaryBaseAffixes.map((entry) => ({
    ...entry,
    value: Number(((entry.value ?? 0) * affixMultiplier * (signatures.has(entry.id) ? 1 + 0.08 * awakening : 1)).toFixed(3)),
  }))
  return {
    ...base,
    legendaryLevel: level,
    damage: Math.max(1, Math.round(base.legendaryBaseDamage * damageMultiplier)),
    affixes,
  }
}

export function growLegendary(item, levels = 1) {
  if (!isLegendaryWeapon(item)) return item
  const base = normalizeLegendary(item)
  return materializeLegendary(base, levelOf(base.legendaryLevel + Math.max(0, Math.floor(levels || 0))))
}

export function legendaryVfxTarget(item) {
  const awakening = legendaryAwakening(item?.legendaryLevel ?? 1)
  return { size: VFX_SIZES[awakening], burst: Math.min(20, 12 + awakening * 2), quantity: 2 }
}

const GROWTH_ROLES = new Set(['combat', 'elite', 'boss', 'antechamber'])

export function growLegendaryForRoom(item, roomRole) {
  if (!isLegendaryWeapon(item) || !GROWTH_ROLES.has(roomRole)) return item
  return growLegendary(item)
}

export function growPlayerLegendaryForRoom(playerState, roomRole) {
  const current = currentWeapon(playerState)
  const grown = growLegendaryForRoom(current, roomRole)
  if (!current || grown === current || grown.legendaryLevel === current.legendaryLevel) {
    return { playerState, grew: false, level: current?.legendaryLevel ?? null, awakening: current ? legendaryAwakening(current.legendaryLevel) : 0, weapon: current ?? null }
  }
  const baseStats = playerState.baseStats ?? { damage: 10, critChance: 0.18, speed: 190, maxHp: 100 }
  const next = { ...deriveEquipment(baseStats, grown, playerState), baseStats: { ...baseStats } }
  return {
    playerState: next,
    grew: true,
    level: grown.legendaryLevel,
    awakening: legendaryAwakening(grown.legendaryLevel),
    weapon: grown,
  }
}
