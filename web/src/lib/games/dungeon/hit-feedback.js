import { movementWithCollision } from './spatial.js'

export function hitFeedback({ critical = false, boss = false, damage = 0 } = {}) {
  const weight = Math.max(0, Math.min(1, Number(damage || 0) / 80))
  let hitStopMs = critical ? 48 : 24
  let shake = critical ? 0.007 : 0.003
  let flashMs = critical ? 130 : 90
  let knockbackScale = critical ? 1.12 : 1

  hitStopMs += Math.round(weight * (critical ? 18 : 10))
  shake += weight * (critical ? 0.002 : 0.001)

  if (boss) {
    hitStopMs = Math.round(hitStopMs * 0.58)
    shake *= 0.75
    flashMs = Math.round(flashMs * 0.82)
    knockbackScale *= 0.22
  }

  return {
    hitStopMs,
    shake: Number(shake.toFixed(4)),
    flashMs,
    knockbackScale: Number(knockbackScale.toFixed(3)),
  }
}

export function knockbackTarget(target, origin, force = 0, geometry = null) {
  const dx = (target?.x ?? 0) - (origin?.x ?? 0)
  const dy = (target?.y ?? 0) - (origin?.y ?? 0)
  const distance = Math.hypot(dx, dy) || 1
  const delta = {
    x: (dx / distance) * Math.max(0, force),
    y: (dy / distance) * Math.max(0, force),
  }
  if (!geometry) return { ...target, x: (target?.x ?? 0) + delta.x, y: (target?.y ?? 0) + delta.y }
  const radius = Math.max(6, target?.hitRadius ?? target?.radius ?? 14)
  const next = movementWithCollision(target, delta, radius, geometry)
  return { ...target, x: next.x, y: next.y }
}
