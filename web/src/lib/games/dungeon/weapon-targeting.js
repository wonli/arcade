import { clipSegmentToSolids } from './spatial.js'

function distanceBetween(a, b) {
  return Math.hypot((b?.x ?? 0) - (a?.x ?? 0), (b?.y ?? 0) - (a?.y ?? 0))
}

export function hasWeaponLineOfSight(start, target, geometry, padding = 6) {
  if (!start || !target) return false
  if (!geometry?.solids?.length) return true
  if (![start.x, start.y, target.x, target.y].every(Number.isFinite)) return true
  return !clipSegmentToSolids(start, target, geometry, padding).blocked
}

export function isWeaponTargetAttackable(player, target, profile, geometry) {
  if (!target || target.hp <= 0) return false
  const range = Number(profile?.range)
  if (Number.isFinite(range) && Number.isFinite(target.x) && Number.isFinite(target.y)) {
    if (distanceBetween(player, target) > range) return false
  }
  return hasWeaponLineOfSight(player, target, geometry)
}

export function nearestAttackableTarget(player, enemies = [], profile, geometry) {
  let best = null
  let bestDistance = Infinity
  for (const enemy of enemies) {
    if (!isWeaponTargetAttackable(player, enemy, profile, geometry)) continue
    const distance = distanceBetween(player, enemy)
    if (distance < bestDistance) {
      best = enemy
      bestDistance = distance
    }
  }
  return best
}
