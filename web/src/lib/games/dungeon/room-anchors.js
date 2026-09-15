import { circleHitsSolid } from './spatial.js'

export function roomAnchor(geometry, kind) {
  if (geometry?.[kind]) return geometry[kind]
  if (kind === 'rest' && geometry?.spawn) return geometry.spawn
  return kind === 'exit' ? { x: 480, y: 600 - 48 * 1.7 } : { x: 480, y: 300 }
}

export function placePlayerAtRoomSpawn(scene, player = scene?.localPlayer) {
  if (!scene || !player) return
  const { x, y } = roomAnchor(scene.__roomGeometry, 'spawn')
  player.state.x = x
  player.state.y = y
  player.actor?.setPosition?.(x, y)
  scene.updateHealthBar?.(player.bar, x, y - 42, player.state.hp, player.state.maxHp)
}

export function safeEnemySpawn(geometry, desired, radius = 15) {
  if (!geometry || !circleHitsSolid(desired, radius, geometry)) return desired
  let best = null
  let distance = Infinity
  const consider = (point) => {
    if (!point || circleHitsSolid(point, radius, geometry)) return
    const nextDistance = Math.hypot(point.x - desired.x, point.y - desired.y)
    if (nextDistance < distance) { best = point; distance = nextDistance }
  }
  for (const point of [...(geometry.spawnPoints ?? []), geometry.spawn]) consider(point)
  // Larger bosses may need more clearance than the generated spawn anchors.
  if (!best) {
    for (let y = radius; y < geometry.height - radius; y += 16) {
      for (let x = radius; x < geometry.width - radius; x += 16) consider({ x, y })
    }
  }
  return best ?? desired
}
