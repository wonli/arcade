import { clipSegmentToSolids } from './spatial.js'

export function facingVector(direction = 'down') {
  return {
    right: { x: 1, y: 0 },
    left: { x: -1, y: 0 },
    up: { x: 0, y: -1 },
    down: { x: 0, y: 1 },
  }[direction] ?? { x: 0, y: 1 }
}

export function piercingAttack(player, direction = 'down', range = 300, width = 28, geometry = null) {
  const start = { x: player?.x ?? 0, y: player?.y ?? 0 }
  const vector = facingVector(direction)
  const desiredEnd = {
    x: start.x + vector.x * Math.max(0, range),
    y: start.y + vector.y * Math.max(0, range),
  }
  const clipped = geometry
    ? clipSegmentToSolids(start, desiredEnd, geometry)
    : { ...desiredEnd, blocked: false }
  return {
    kind: 'piercing',
    start,
    end: { x: clipped.x, y: clipped.y },
    width,
    blocked: Boolean(clipped.blocked),
    direction: vector,
  }
}

export function whirlwindAttack(player, radius = 105) {
  return {
    kind: 'whirlwind',
    center: { x: player?.x ?? 0, y: player?.y ?? 0 },
    radius: Math.max(0, radius),
  }
}

function pointSegmentDistance(point, start, end) {
  const dx = end.x - start.x
  const dy = end.y - start.y
  const lengthSq = dx * dx + dy * dy
  if (lengthSq <= 1e-9) return Math.hypot(point.x - start.x, point.y - start.y)
  const t = Math.max(0, Math.min(1, ((point.x - start.x) * dx + (point.y - start.y) * dy) / lengthSq))
  const x = start.x + dx * t
  const y = start.y + dy * t
  return Math.hypot(point.x - x, point.y - y)
}

export function targetsInBeam(attack, enemies = []) {
  const halfWidth = Math.max(1, (attack?.width ?? 20) / 2)
  return enemies.filter((enemy) => {
    if (!enemy || enemy.hp <= 0) return false
    const radius = Math.max(0, enemy.hitRadius ?? enemy.radius ?? 8)
    return pointSegmentDistance(enemy, attack.start, attack.end) <= halfWidth + radius
  })
}

export function targetsInCircle(attack, enemies = []) {
  const center = attack?.center ?? { x: 0, y: 0 }
  const radius = Math.max(0, attack?.radius ?? 0)
  return enemies.filter((enemy) => enemy && enemy.hp > 0 && Math.hypot(enemy.x - center.x, enemy.y - center.y) <= radius + Math.max(0, enemy.hitRadius ?? enemy.radius ?? 0))
}

function nearestUnused(source, enemies, used, range) {
  let best = null
  let bestDistance = Math.max(0, range)
  for (const enemy of enemies) {
    if (!enemy || enemy.hp <= 0 || used.has(enemy.id)) continue
    const distance = Math.hypot(enemy.x - source.x, enemy.y - source.y)
    if (distance > bestDistance) continue
    best = enemy
    bestDistance = distance
  }
  return best
}

export function thunderChain(source, primary, enemies = [], hops = 3, range = 190) {
  if (!primary || primary.hp <= 0 || hops <= 0) return []
  const segments = [{ from: source, to: primary }]
  const used = new Set([primary.id])
  let current = primary
  for (let index = 1; index < hops; index++) {
    const next = nearestUnused(current, enemies, used, range)
    if (!next) break
    segments.push({ from: current, to: next })
    used.add(next.id)
    current = next
  }
  return segments
}
